import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { setupTelegram } from './telegram-setup.mjs';

const root = new URL('../../', import.meta.url);
const temp = await mkdtemp(fileURLToPath(new URL('./.helper-test-', import.meta.url)));
const envPath = temp + '/test.env', configPath = temp + '/config.json', examplePath = temp + '/example.json';
let updates = [], calls = [], sendFails = false;
const server = createServer(async (req, res) => {
  let text = ''; for await (const chunk of req) text += chunk;
  const method = req.url.split('/').at(-1), body = JSON.parse(text);
  calls.push({method,body});
  res.setHeader('Content-Type','application/json');
  if (method === 'sendMessage' && sendFails) return res.end(JSON.stringify({ok:false,error_code:401,description:'not logged'}));
  res.end(JSON.stringify({ok:true,result:method === 'getMe' ? {is_bot:true} : method === 'getUpdates' ? (body.offset ? [] : updates) : {message_id:1}}));
});
try {
  await new Promise((resolve,reject) => { server.once('error',reject); server.listen(0,'127.0.0.1',resolve); });
  const apiBase = 'http://127.0.0.1:' + server.address().port;
  const options = {envPath,configPath,examplePath,apiBase};
  await writeFile(examplePath, JSON.stringify({guard:'preserve',telegram:{enabled:false,chatId:''}}));
  await writeFile(envPath, '# deliberately no credential\n');
  await assert.rejects(setupTelegram(options), /missing or empty/);
  assert.equal(calls.length,0);
  await assert.rejects(readFile(configPath), {code:'ENOENT'});
  console.log('PASS missing token: no API requests or config write');
  // Deliberately synthetic credential; never read the real .env during tests.
  await writeFile(envPath, 'TELEGRAM_BOT_TOKEN_ALL="123:local-test-only"\n');
  await assert.rejects(setupTelegram(options), /No incoming messages/);
  assert.deepEqual(calls.map(c => c.method), ['getMe','getUpdates']);
  await assert.rejects(readFile(configPath), {code:'ENOENT'});
  console.log('PASS empty updates via local fake server: no config write or message');
  calls = [];
  updates = [
    {update_id:3,message:{date:30,chat:{id:300},from:{is_bot:false}}},
    {update_id:9,message:{date:20,chat:{id:200},from:{is_bot:false}}},
    {update_id:10,message:{date:40,chat:{id:400},from:{is_bot:true}}},
  ];
  await setupTelegram(options);
  let config = JSON.parse(await readFile(configPath,'utf8'));
  assert.deepEqual(config,{guard:'preserve',telegram:{enabled:true,chatId:'300'}});
  assert.equal(calls.filter(c => c.method === 'sendMessage').length,1);
  assert.equal(calls.at(-1).body.chat_id,'300');
  console.log('PASS latest human message selection, example copy, config fields, one test message');
  updates = Array.from({length:100},(_,i)=>({update_id:i,message:{date:i,chat:{id:i},from:{is_bot:false}}}));
  calls = []; await setupTelegram(options);
  assert.equal(calls.filter(c=>c.method==='getUpdates').length,2);
  assert.equal(calls.find(c=>c.body.offset)?.body.offset,100);
  assert.equal(JSON.parse(await readFile(configPath,'utf8')).telegram.chatId,'99');
  console.log('PASS pagination and preservation of existing configuration');
  sendFails = true;
  await assert.rejects(setupTelegram(options), error => error.message === 'Telegram sendMessage failed. Check the token, network and bot settings, then rerun.');
  console.log('PASS credential-free API failure');

  const html = await readFile(new URL('apps/detector/labels/h9-review.html',root),'utf8');
  const samplePath = new URL('apps/detector/labels/h9-sample.csv',root);
  const original = await readFile(samplePath,'utf8');
  const context = vm.createContext({document:{getElementById:()=>({addEventListener(){}}),querySelectorAll:()=>[]},window:{addEventListener(){}}});
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
  context.input = original;
  assert.equal(vm.runInContext('rows=loadRows(input); answers=rows.map(()=>({label:"",notes:""})); rows.length',context),30);
  assert.equal(vm.runInContext('rows.some(r=>r.label || r.notes)',context),false);
  assert.equal(vm.runInContext('counts().precision',context),null);
  assert.equal(vm.runInContext('counts().unlabelled',context),30);
  console.log('PASS real sample imports 30 rows with no AI labels, notes or preloaded answers');
  context.input = "a,b\r\n\"one,two\",\"say \"\"hi\"\"\"\r\n";
  assert.equal(vm.runInContext('parseCsv(input)[1][1]',context),'say "hi"');
  context.input = "\"unclosed";
  assert.throws(()=>vm.runInContext('parseCsv(input)',context));
  context.input = original.replace('https://etherscan.io/tx/','javascript:');
  assert.throws(()=>vm.runInContext('loadRows(input)',context));
  console.log('PASS CSV quotes/CRLF and untrusted transaction link rejection');
  // Synthetic fixtures only: no human answer is assigned to a real H9 record.
  vm.runInContext('rows=Array.from({length:4},(_,i)=>({n:String(i+1),label:"",variant:"dust",victim:"0x"+"1".repeat(40),impersonated:"0x"+"2".repeat(40),lookalike:"0x"+"3".repeat(40),attack_tx:"https://etherscan.io/tx/0x"+"4".repeat(64),reference_tx:"https://etherscan.io/tx/0x"+"5".repeat(64),notes:""})); answers=[{label:"yes",notes:"quote, newline\\n=SUM(A1)"},{label:"no",notes:""},{label:"unsure",notes:""},{label:"",notes:""}]',context);
  const output = vm.runInContext('exportCsv("Synthetic test reviewer")',context);
  const require = createRequire(new URL('apps/detector/package.json',root));
  const ts = require('typescript');
  const source = await readFile(new URL('apps/detector/src/labels.ts',root),'utf8');
  const compiled = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const module = {exports:{}};
  vm.runInNewContext(compiled,{exports:module.exports,module,require});
  const precision = module.exports.precisionOf(output);
  assert.equal(precision.precision,0.5); assert.equal(precision.yes,1); assert.equal(precision.no,1); assert.equal(precision.unsure,1); assert.equal(precision.unlabelled,1);
  assert.equal(vm.runInContext('counts().precision',context),precision.precision);
  assert.match(vm.runInContext('summaryText("Synthetic test reviewer")',context), /Incomplete review/);
  assert.equal(output.trim().split('\n').length,5);
  assert.equal(await readFile(samplePath,'utf8'),original);
  console.log('PASS exported synthetic answers parsed by unchanged labels.ts: 50%, 1 unsure, 1 unanswered; sample untouched');
} finally {
  server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));
  for (const name of ['test.env','config.json','example.json']) { try { await unlink(temp+'/'+name); } catch(error) { if(error.code!=='ENOENT') throw error; } }
  await rmdir(temp);
}
