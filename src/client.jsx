import React from 'react';
import App from './App.jsx';
export const name='procurement-workbench-client';
export const inject=['slots'];
export function apply(ctx){
 ctx.slots.inject('main',()=>ctx.slots.register({name:'main',key:'procurement-workbench'},App));
 ctx.slots.inject('sidebar.panellist',()=>ctx.slots.register({name:'sidebar.panellist',id:'procurement-workbench',order:30,label:'采购工作台'},({size=18})=><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>));
}
