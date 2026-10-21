'use strict';

const fs = require('node:fs');
const path = require('node:path');
const htmllint = require('htmllint');

const htmlDirectory = path.resolve(__dirname, '../src/html');
const configPath = path.resolve(__dirname, '../.htmllintrc.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

async function lintHtmlFiles() {
  const filenames = fs.readdirSync(htmlDirectory).filter((filename) => filename.endsWith('.html'));

  for (const filename of filenames) {
    const filePath = path.join(htmlDirectory, filename);
    const source = fs.readFileSync(filePath, 'utf8');
    const issues = await htmllint(source, config);

    if (issues.length > 0) {
      console.log(`\n${filePath}`);
      issues.forEach((issue) => {
        const message = issue.msg || htmllint.messages.renderIssue(issue);
        console.log(`line ${issue.line}\tcol ${issue.column}\t${message} (${issue.code})`);
      });
    }
  }
}

lintHtmlFiles().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
