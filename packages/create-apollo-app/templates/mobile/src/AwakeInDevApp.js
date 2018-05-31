import Expo, { Constants } from 'expo';
import React from 'react';
import PropTypes from 'prop-types';
import { View } from 'react-native';
import App from './App';

// we don't want this to require transformation
class AwakeInDevApp extends React.Component {
  static propTypes = {
    exp: PropTypes.object
  };
  state = {
    isReady: false
  };

  async componentWillMount() {
    this.setState({ isReady: true });
  }

  render() {
    if (!this.state.isReady) {
      return <Expo.AppLoading />;
    }

    return React.createElement(
      View,
      {
        style: {
          flex: 1,
          marginTop: Constants.statusBarHeight
        }
      },
      React.createElement(App, this.props),
      React.createElement(process.env.NODE_ENV === 'development' ? Expo.KeepAwake : View)
    );
  }
}

Expo.registerRootComponent(AwakeInDevApp);
