export namespace ask {
  function download(urlOptions:any, filePath:string): Promise<any>;
  function request(urlOptions:any): Promise<any>;
  function get(urlOptions:any): Promise<any>;
}

export namespace utility {
  function createUniqueId(structure:string): string;
  function timeCheck(ended:any): any;
}

// export class timer {}
interface timer {
  time:any;
}
export function timer(time:string):timer;

interface burglish {
  text:String;
  toUnicode:String;
  toZawgyi:String;
}

export function burglish(str:string):burglish;

// export declare class burglish {
//   constructor(str:String):this;
//   text:String;
//   toUnicode:String;
//   toZawgyi:String;
// }

export namespace service {}


// export default {ask,utility,timer,burglish}
// export declare namespace utility;

// export const utility:utility;

// export declare interface ask {}
// export declare interface utility {}
// namespace service {
//   interface ask {}
//   interface utility {}
//   interface timer {}
//   interface burglish {
//     toUnicode: string,
//     toZawgyi: string,
//   }
// }
// export declare function square(number: number, offset?: number): number;
// export = service;
// export declare class burglish(string): string;
