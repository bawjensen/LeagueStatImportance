/**
 * React Starter Kit (https://www.reactstarterkit.com/)
 *
 * Copyright © 2014-2016 Kriasoft, LLC. All rights reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import React, { PropTypes } from 'react';
import withStyles from 'isomorphic-style-loader/lib/withStyles';
import s from './Layout.css';
import Header from '../Header';
import Footer from '../Footer';

class Layout extends React.Component {
  static propTypes = {
    children: PropTypes.node.isRequired,
  };

  componentDidMount() {
    componentHandler.upgradeElement(this.node); // eslint-disable-line no-undef
  }

  render() {
    const containerClass = `${s.container} mdl-layout mdl-js-layout`;

    return (
      <div
        className={containerClass}
        ref={node => { this.node = node; }}
      >
        <Header />
        <main className="mdl-layout__content">
          {this.props.children}

          <Footer />
        </main>
      </div>
    );
  }
}

export default withStyles(s)(Layout);
