export default class Platform {
    features: string[];
    target: string;

    constructor(...features) {
        this.features = features.reduce((acc, feature) => {
            if (!feature) {
                return acc;
            } else if (feature.constructor === Array) {
                return acc.concat(feature);
            } else {
                return acc.concat(feature.split(':'));
            }
        }, []);
        if (this.hasAny('server')) {
            this.target = 'server';
        } else if (this.hasAny('web')) {
            this.target = 'web';
        } else if (this.hasAny('android')) {
            this.target = 'android'
        } else if (this.hasAny('ios')) {
            this.target = 'ios';
        }
    }

    hasAny(arg): Boolean {
        const array = arg.constructor === Array ? arg : [arg];
        for (let feature of array) {
            if (this.features.indexOf(feature) >= 0) {
                return true;
            }
        }
        return false;
    }
}
