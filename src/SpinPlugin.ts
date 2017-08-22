import Spin from "./Spin";

export interface SpinPlugin
{
    configure?(builder, spin: Spin): Object
}
