// @ts-nocheck

import * as rule from './burglish-rule.js';

/**
 * new Burglish('String').toUnicode;
 * new Burglish('String').toZawgyi;
 */
export default class Burglish {
  text;

  constructor(str) {
    this.text = str;
  }

  get toUnicode(){
    return this.convert(rule.unicode);
  }

  get toZawgyi(){
    return this.convert(rule.zawgyi);
  }
  /**
   * @param {from:string,to:string}[] rule
   * @returns string
   */
  convert(rule){
    for (var i = 0, len = rule.length; i < len; i++) this.text = this.text.replace(new RegExp(rule[i].from,"g"),rule[i].to);
    return this.text;
  }
}