var promises    = require('../helpers/promised.js'),
    querystring = require('querystring');

// --------------------------------------- Global Variables -------------------------------------

var API_KEY             = process.env.RIOT_CHALLENGE_KEY;
var DEFAULT_RATE_LIMIT  = 1000;
var RATE_LIMIT          = DEFAULT_RATE_LIMIT;
var MATCH_LIMIT         = process.argv[3] ? parseInt(process.argv[3]) : 10000;

var MODE = process.argv[2] ?
                (process.argv[2] === 'a' ? 'After' : 'Before') :
                'After';

console.log('In mode:', MODE);

var endpointPrefix      = 'https://'
var apiUrl              = '.api.pvp.net/api/lol/'
var matchEndpoint       = '/v2.2/match/';

var matchOptions = {
    'includeTimeline': 'true',
    'api_key': API_KEY
}

var matchQuery      = '?' + querystring.stringify(matchOptions);

// --------------------------------------- Helper Functions -------------------------------------

function logErrorAndRethrow(err) {
    console.error(err.stack);
    throw err;
}

// --------------------------------------- Main Functions ---------------------------------------

function fetchAndStore() {
    var db;
    var desiredData = new Set([ 'timeline', 'participants' ]);
    var desiredTimelineData = new Set([ 'frames' ]);
    var desiredFrameData = new Set([ 'events' ]);
    var desiredParticipantData = new Set([ 'championId', 'participantId', 'winner' ]);

    var matchTypes = [
        'RANKED_SOLO',
        'NORMAL_5X5'
    ];

    var allRegions = [
        { filePrefix: 'BR', regionStr: 'br' },
        { filePrefix: 'EUNE', regionStr: 'eune' },
        { filePrefix: 'EUW', regionStr: 'euw' },
        { filePrefix: 'KR', regionStr: 'kr' },
        { filePrefix: 'LAN', regionStr: 'lan' },
        { filePrefix: 'LAS', regionStr: 'las' },
        { filePrefix: 'NA', regionStr: 'na' },
        { filePrefix: 'OCE', regionStr: 'oce' },
        { filePrefix: 'RU', regionStr: 'ru' },
        { filePrefix: 'TR', regionStr: 'tr' }
    ];

    var allRegionUrls = [];
    return Promise.all(
        matchTypes.map(function(matchType) {
            return Promise.all(
                allRegions.map(function(regionObj) {
                    return promises.read('json-data/matches/' + (MODE === 'After' ? '5.14' : '5.11') + '/' + matchType + '/' + regionObj.filePrefix + '.json')
                        .catch(function(err) {
                            console.log(regionObj);
                            throw err;
                        })
                        .then(function(matches) {
                            let regionEndpoint = endpointPrefix + regionObj.regionStr + apiUrl + regionObj.regionStr + matchEndpoint;
                            return matches.slice(0, MATCH_LIMIT).map(function(matchId) { return regionEndpoint + matchId + matchQuery });
                        })
                        .then(function(regionUrls) {
                            return Array.prototype.push.apply(allRegionUrls, regionUrls); // Extends one array with the other
                        });
                    })
                );
            })
        )
        .then(function() {
            return promises.openDB('mongodb://localhost:27017/lol-data')
                .then(function(newDB) { db = newDB; })
                .then(function() {
                    return promises.rateLimitedGet(allRegionUrls, RATE_LIMIT,
                        function(apiUrl) {
                            return promises.persistentGet(apiUrl);
                        },
                        function(matchData) {
                            let isWinningTeam = {};
                            matchData.teams.forEach(function(team) {
                                isWinningTeam[team.teamId] = team.winner;
                            });

                            matchData.participants.forEach(function(participant) {
                                participant.winner = isWinningTeam[participant.teamId];
                                for (var key in participant) {
                                    if (!desiredParticipantData.has(key))
                                        delete participant[key];
                                }
                            });

                            matchData.timeline.frames = matchData.timeline.frames.filter(function(frame) {
                                if (!frame.events) return false;

                                for (var key in frame) {
                                    if (!desiredFrameData.has(key))
                                        delete frame[key];
                                }

                                frame.events = frame.events.filter(function(evt) {
                                    return evt.eventType === 'ITEM_PURCHASED' || evt.eventType === 'ITEM_UNDO';
                                });
                                return frame.events.length !== 0;
                            });
                            for (var key in matchData.timeline) {
                                if (!desiredTimelineData.has(key))
                                    delete matchData.timeline[key];
                            }

                            for (var key in matchData) {
                                if (!desiredData.has(key)) {
                                    delete matchData[key];
                                }
                            }

                            db.collection('matches' + MODE).insert(matchData);
                        });
                });
        })
        .catch(logErrorAndRethrow)
        .then(function() { db.close(); });
}

var start = (new Date).getTime();
fetchAndStore()
    .then(function() {
        var end = (new Date).getTime();
        var minutes = (end - start) / 60000;
        console.log('Took', minutes, 'minutes');
        db.close();
    });
