import { closeSync, openSync } from 'fs';
import * as minilog from 'minilog';
import { join, resolve } from 'path';

import { resolveAndroidAppPath } from '../projectHelpers';
import ProjectSnapshotGenerator from '../snapshot/android/project-snapshot-generator';

const logger = minilog(`project-snapshot-generator`);

export default class NativeScriptSnapshotPlugin extends ProjectSnapshotGenerator {
  constructor(options: any) {
    super(options); // Call the parent constructor

    if (!this.options.chunk) {
      throw new Error('No chunk specified.');
    }

    if (this.options.webpackConfig) {
      if (this.options.webpackConfig.output && this.options.webpackConfig.output.libraryTarget) {
        this.options.webpackConfig.output.libraryTarget = undefined;
      }

      if (this.options.webpackConfig.entry) {
        if (typeof this.options.webpackConfig.entry === 'string' || this.options.webpackConfig.entry instanceof Array) {
          this.options.webpackConfig.entry = { bundle: this.options.webpackConfig.entry };
        }
      }

      this.options.webpackConfig.entry['tns-java-classes'] = this.getTnsJavaClassesBuildPath();
    }
  }

  public getTnsJavaClassesBuildPath = () => {
    return resolve(this.getBuildPath(), '../tns-java-classes.js');
  };

  public generate = (webpackChunk: any) => {
    const options = this.options;

    const inputFile = join(options.webpackConfig.output.path, webpackChunk.files[0]);

    logger.info(`\n Snapshotting bundle at ${inputFile}`);

    const preparedAppRootPath = resolveAndroidAppPath(this.options.projectRoot);
    const preprocessedInputFile = join(preparedAppRootPath, '_embedded_script_.js');

    return ProjectSnapshotGenerator.prototype.generate
      .call(this, {
        inputFile,
        preprocessedInputFile,
        targetArchs: options.targetArchs,
        useLibs: options.useLibs,
        androidNdkPath: options.androidNdkPath,
        tnsJavaClassesPath: join(preparedAppRootPath, 'tns-java-classes.js')
      })
      .then(() => {
        // Make the original file empty
        if (inputFile !== preprocessedInputFile) {
          closeSync(openSync(inputFile, 'w')); // truncates the input file content
        }
      });
  };

  public apply = (compiler: any) => {
    const options = this.options;

    // Generate tns-java-classes.js file
    ProjectSnapshotGenerator.prototype.generateTnsJavaClassesFile.call(this, {
      output: this.getTnsJavaClassesBuildPath(),
      options: options.tnsJavaClassesOptions
    });

    // Generate snapshots
    compiler.plugin(
      'after-emit',
      function(compilation: any, callback: any) {
        const chunkToSnapshot = compilation.chunks.find(chunk => chunk.name === options.chunk);
        if (!chunkToSnapshot) {
          throw new Error(`No chunk named '${options.chunk}' found.`);
        }

        this.generate(chunkToSnapshot)
          .then(() => {
            logger.info('Successfully generated snapshots!');
            callback();
          })
          .catch(error => {
            logger.error('Snapshot generation failed with the following error:');
            logger.error(error);
            callback();
          });
      }.bind(this)
    );
  };
}
