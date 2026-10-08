import {createHash} from 'node:crypto';
// Reads from stdin to avoid placing a password in command-line arguments.
let input='';for await(const chunk of process.stdin)input+=chunk;
const password=input.replace(/\r?\n$/,'');if(password.length<14){console.error('Use at least 14 characters.');process.exit(1)}
console.log(createHash('sha256').update(password).digest('hex'));
