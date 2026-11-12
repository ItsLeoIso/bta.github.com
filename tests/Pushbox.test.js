import test from "node:test";
import assert from "node:assert/strict";
import {getPushbox,resolvePushboxes} from "../src/movement/Pushbox.js";
const fighter=(x,y=440,crouching=false,previousX=x)=>({x,y,crouching,previousX});
const bounds={minX:68,maxX:892};
test("separates overlapping fighters equally",()=>{
 const a=fighter(400),b=fighter(500);
 assert.equal(resolvePushboxes(a,b,bounds),true);
 assert.equal(a.x,395);assert.equal(b.x,505);
});
test("touching pushboxes do not create extra movement",()=>{
 const a=fighter(390),b=fighter(500);
 assert.equal(resolvePushboxes(a,b,bounds),false);
 assert.equal(a.x,390);assert.equal(b.x,500);
});
test("fighters at different vertical levels do not collide",()=>{
 assert.equal(resolvePushboxes(fighter(400,300),fighter(450,440),bounds),false);
});
test("crouching uses the shorter pushbox",()=>{
 const box=getPushbox(fighter(400,440,true));
 assert.equal(box.top,390);assert.equal(box.bottom,440);
});
test("a cornered fighter transfers its share to the other fighter",()=>{
 const a=fighter(68),b=fighter(150);
 assert.equal(resolvePushboxes(a,b,bounds),true);
 assert.equal(a.x,68);assert.equal(b.x,178);
});
test("identical centers use previous side order for deterministic separation",()=>{
 const a=fighter(450,440,false,430),b=fighter(450,440,false,470);
 assert.equal(resolvePushboxes(a,b,bounds),true);
 assert.ok(a.x<b.x);assert.equal(a.x,395);assert.equal(b.x,505);
});
test("both fighters remain inside stage bounds",()=>{
 const a=fighter(850),b=fighter(892);
 resolvePushboxes(a,b,bounds);
 assert.ok(a.x>=bounds.minX&&a.x<=bounds.maxX);
 assert.ok(b.x>=bounds.minX&&b.x<=bounds.maxX);
});
test("a jump can clear a standing pushbox",()=>{
 assert.equal(resolvePushboxes(fighter(450,350),fighter(500,440),bounds),false);
});
