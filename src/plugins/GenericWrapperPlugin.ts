
import { Builder } from '../Builder';
import { ConfigPlugin } from '../ConfigPlugin';
import Spin from '../Spin';
import JSRuleFinder from './shared/JSRuleFinder';

/**
 * Generic wrapper that is used to accomodate other plugin instances
 * in the spinrc config.
 */
export default class GenericWrappingPlugin implements ConfigPlugin {
    private pluginInstance:any

    constructor(pluginInstance : any){
        this.pluginInstance = pluginInstance
    }
    public configure(builder: Builder, spin: Spin) {
        builder.config = spin.merge(builder.config, {
            plugins: [
                this.pluginInstance
            ]
          });
    }
}