import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate} from '../src/lib/pricing.ts';

const rules=[
  ['size','medium',1200],['style','portrait',300],['medium','acrylic',200],
  ['frame','none',0],['complexity','simple',100],['priority','standard',0]
].map(([kind,option_key,amount])=>({kind,option_key,label:`${kind}: ${option_key}`,amount,active:true}));
const selected={size:'medium',style:'portrait',medium:'acrylic',frame:'none',complexity:'simple',priority:'standard'};

test('totals active database rules for all six selected options',()=>{
  const result=calculate(rules,selected);
  assert.equal(result.total,1800);
  assert.equal(result.components.length,6);
});

test('rejects unavailable or inactive pricing options',()=>{
  assert.throws(()=>calculate(rules,{...selected,size:'invalid'}));
  assert.throws(()=>calculate(rules.map(r=>r.kind==='frame'?{...r,active:false}:r),selected));
});
