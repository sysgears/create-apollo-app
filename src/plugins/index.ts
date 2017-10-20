import AngularPlugin from './AngularPlugin';
import ApolloPlugin from './ApolloPlugin';
import CssProcessorPlugin from './CssProcessorPlugin';
import ES6Plugin from './ES6Plugin';
import FlowRuntimePLugin from './FlowRuntimePlugin';
import ReactHotLoaderPlugin from './ReactHotLoaderPlugin';
import ReactNativePlugin from './ReactNativePlugin';
import ReactNativeWebPlugin from './ReactNativeWebPlugin';
import ReactPlugin from './ReactPlugin';
import StyledComponentsPlugin from './StyledComponentsPlugin';
import TCombPlugin from './TCombPlugin';
import TypeScriptPlugin from './TypeScriptPlugin';
import VuePlugin from './VuePlugin';
import WebAssetsPlugin from './WebAssetsPlugin';
import WebpackPlugin from './WebpackPlugin';

export default [
  new WebpackPlugin(),
  new WebAssetsPlugin(),
  new CssProcessorPlugin(),
  new ApolloPlugin(),
  new TypeScriptPlugin(),
  new ES6Plugin(),
  new ReactPlugin(),
  new ReactHotLoaderPlugin(),
  new TCombPlugin(),
  new FlowRuntimePLugin(),
  new ReactNativePlugin(),
  new ReactNativeWebPlugin(),
  new StyledComponentsPlugin(),
  new AngularPlugin(),
  new VuePlugin()
];
