import creator from '@jsapp/creator';
import 'source-map-support/register';

import templates from './templates';

creator(templates, 'yarn create apollo-app', process.argv);
