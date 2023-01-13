const cron = require('node-cron');
const shell = require('shelljs');
const Schedule = '1,10,20,30,40,50 * * * * *';
const Schedule1 = '15,45 * * * * *';
const Schedule2 = '1,30 * * * * *';
const Schedule3 = '5,10,15,20,25,30,35,40,45,50,55 * * * * *';


function scheduler(task) {
    cmd = 'python3 ../dbmaint/' + task + ".py"
    if (shell.exec(cmd).code !== 0) {
        shell.exit(1);
      }
      else {
        shell.echo(task + ' complete');
      }
}

function schedule_insert(schedule = Schedule3) { 
  cron.schedule(schedule, function(){
      scheduler("insert_guest_sequences")
  });
}
exports.schedule_insert = schedule_insert;

function schedule_delete(schedule = '* * * * *') {
    cron.schedule(schedule, function(){
        scheduler("delete_guest_sequences")
  });
}
exports.schedule_delete = schedule_delete

function schedule_heartbeat(schedule = Schedule3) {
    cron.schedule(schedule, function(){
        scheduler("heartbeat")
    });
}

exports.schedule_heartbeat = schedule_heartbeat;

//schedule_insert()

