import * as inquirer from 'inquirer';
import * as path from 'path';

const prompt = inquirer.createPromptModule();

export default () => {
    const questions = [{
        name: 'name',
        message: 'name',
        default: path.basename(process.cwd(), path.extname(process.cwd())),
    }, {
        name: 'version',
        message: 'version',
        default: '1.0.0',
    }, {
        name: 'repo',
        message: 'repository url',
        default: '',
    }, {
        name: 'author',
        message: 'author',
        default: '',
    }];

    prompt(questions).then(answers => {
        console.log(answers);
    })
}