const fs = require('fs');
const https = require('https');
const nodemailer = require('nodemailer');
const config = require('./config.js')
/********** NODEMAILER SETUP **********/
const transporter = nodeMailer.createTransport({
  service: config.sourceEmail.substring(
      config.sourceEmail.indexOf('@'),
      config.sourceEmail.indexOf('.', config.sourceEmail.indexOf('@'))
    ),
  auth: {
    user: config.sourceEmail,
    pass: config.sourceEmailPassword
  }
});

/********** CONSTANTS **********/
const DESIRED_TITLE = 'Engineer'.toUpperCase();
const TABLE_BEGIN_TAG = 'job-list__body list--unstyled';
const ROW_TAG = 'job-row--body';
const END_ROW_TAG = '</a>';
const START_DIV_TAG = '<div';
const END_DIV_TAG = '</div>';
const ROW_STRUCT = ['Title', 'Craft', 'Team', 'Office'];
const JOBS_FILENAME = './riot-jobs.json';
const HTTP_OPTIONS = {
  hostname: 'www.riotgames.com',
  port: '80',
  path: '/en/work-with-us/jobs',
  method: 'GET'
};

/********** CODE **********/
getJobsHtml()
  .then(processJobsHtml)
  .then(compareJobs)
  .then(saveJobs)
  .catch(error => console.log(error));

function getJobsHtml() {
  return new Promise(function(accept, reject) {
    https.get('https://www.riotgames.com/en/work-with-us/jobs', (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => accept(data));
    }).on('error', err => reject('ERROR: ' + err));
  });
}

function readJobsHtml() {
  return new Promise(function(accept, reject) {
    fs.readFile('./riot-jobs.html', 'utf8', (err, data) => {
      if (err) {
        console.error(err);
        return reject(err);
      }
      return accept(data);
    });
  });
}

function processJobsHtml(data) {
  const jobs = {};
  let curIndex = data.indexOf(TABLE_BEGIN_TAG);
  let endRowIndex;
  data = data.substring(data.indexOf(TABLE_BEGIN_TAG));

  // For every row in the jobs table
  for (let index = data.indexOf(ROW_TAG); index !== -1; index = data.indexOf(ROW_TAG, endRowIndex)) {
    endRowIndex = data.indexOf(END_ROW_TAG, index);
    // const snip = data.substring(index, endRowIndex);
    let colIndex = index;
    const job = {};

    const hrefIndex = data.indexOf('href', index) + 6;
    const link = data.substring(hrefIndex, data.indexOf('"', hrefIndex));
    const id = link.substring(link.lastIndexOf('/') + 1);
    jobs[id] = job;

    // There are four fields per row, Title, Craft, Team, Office
    for (let i = 0; i < 4; i++) {
      const fieldStartIndex = data.indexOf('>', data.indexOf(START_DIV_TAG, colIndex)) + 1;
      const fieldEndIndex = data.indexOf(END_DIV_TAG, fieldStartIndex);
      job[ROW_STRUCT[i]] = data.substring(fieldStartIndex, fieldEndIndex);
      colIndex = fieldEndIndex;
    }
  }

  return jobs;
}

function compareJobs(newJobs) {
  return new Promise(function(accept, reject) {
    fs.readFile(JOBS_FILENAME, function(error, data) {
      if (error) {
        // If the file doesn't exist, we still want to save the new jobs
        if (error.code === 'ENOENT') accept(newJobs);
        return reject(error);
      }
      const oldJobs = JSON.parse(data);

      const oldIds = Object.keys(oldJobs);
      const newIds = Object.keys(newJobs);
      const addedIds = newIds.filter(id => !oldIds.includes(id));
      addedIds.forEach(jobId => {
        const job = newJobs[jobId];
        const title = newJobs[jobId].Title.toUpperCase();
        if (title.includes(DESIRED_TITLE) &&
            !title.includes('SENIOR') &&
            !title.includes('STAFF') &&
            !title.includes('SR.') &&
            !title.includes('MANAGER')) {
          sendJobEmail(job, jobId).catch(err => console.log(err));
        }
      });

      return accept(newJobs);
    });
  });
}

function sendJobEmail(job, id) {
  return new Promise(function(accept, reject) {
    let emailBody = 'Link to position: https://www.riotgames.com/en/j/' + id + '\n';
    Object.entries(job).forEach(([fieldName, value]) => {
      emailBody += fieldName + ': ' + value + '\n';
    });

    const mailOptions = {
      from: config.sourceEmail,
      to: config.destEmail,
      subject: 'NEW ' + DESIRED_TITLE + ' JOB AT RIOT',
      text: emailBody
    };

    transporter.sendMail(mailOptions, function(error, info) {
      if (error) return reject(error);
      return accept();
    });
  });
}

function saveJobs(jobs) {
  return new Promise(function(accept, reject) {
    fs.writeFile(JOBS_FILENAME, JSON.stringify(jobs), function(error) {
      if (error) return reject(error);
      return accept();
    });
  });
}
