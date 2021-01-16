// @ts-check
/**
 * new Timer([10:00,00:22]).shorten();
 * new Timer(12*1000).shorten();
 * new Timer(33).isSeconds().shorten();
 * new Timer(12*200).isMilliseconds().shorten();
 * result:any[]=[0,0,0];
 * time:any;
 * data:any[]=new Array;
 * @property {number[]} result =[0,0,0];
 * @property {any} time;
 * @property {any[]} data=new Array;
 */

export default class Timer {
  result=[0,0,0];
  time;
  data=new Array;

  /**
   * @param {any} time
   */
  constructor(time) {
    this.time = time;
    if (time){
      if (Array.isArray(time)) {
        this.data=time;
      } else if (typeof time == 'string' && time.includes(":")) {
        this.data=time.split(",");
      }
    }
  }

  isMilliseconds(){
    if (!this.data.length) this.data=[this.datetime(this.time)];
    return this;
  }

  isSeconds(){
    if (!this.data.length) this.data=[this.datetime((this.time) * 1000)];
    return this;
  }

  /**
   * @param {any} time
   */
  datetime(time){
    // return (new Date(time)).toUTCString().match(/(\d\d:\d\d:\d\d)/)[0];
    const m = new Date(time).toUTCString().match(/(\d\d:\d\d:\d\d)/);
    if (m) return m[0];
    return null;
  }

  /**
   * @param {number[]} num
   */
  sum(num){
    if (!this.data.length && num) this.data=num;
    return this.data.reduce(function(a,b) {
      return a + b
    });
  }

  /**
   * @param {number} i
   */
  convert(i){
    // let minutes = Math.floor(time / 60); return time - minutes * 60;
    let leftOver = Math.floor(this.result[i] / 60);
    this.result[i] = this.result[i] - leftOver * 60;
    return leftOver;
  }

  get(){
    if (!this.data.length) this.isSeconds();

    for(const raw of this.data){
      let row =raw.split(':');
      if (row.length == 3) {
        this.result[0] += parseInt(row[0]);
        this.result[1] += parseInt(row[1]);
        this.result[2] += parseInt(row[2]);
      } else if (row.length == 2) {
        this.result[1] += parseInt(row[0]);
        this.result[2] += parseInt(row[1]);
      }
    }
    this.result[1] += this.convert(2);
    this.result[0] += this.convert(1);
    return this.result;
  }

  format(){
    return this.get().map(function(e){
      return (e < 10)?'0'+e:e;
    }).join(':');
  }

  shorten(){
    return this.correction(this.format().replace(/^[0|\D]*/,''));
  }

  /**
   * @example 02:20
   * @param {string} time
   */
  correction(time){
    time = time||this.time;
    switch(time.length) {
      case 1: return '0:0'+time;
      case 2: return '0:'+time;
      default: return time;
    }
  }
};