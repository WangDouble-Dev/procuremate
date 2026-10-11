import {createStorage,createStorageHandler,API_PATH} from './storage.mjs';
export const name='procurement-workbench';
export const inject=['webServer'];
export function apply(ctx){
 const handler=createStorageHandler(createStorage());
 ctx.effect(()=>ctx.webServer.register({kind:'exact',path:API_PATH,handler}));
}
