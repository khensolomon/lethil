import path from "path";
import * as seek from "../aid/seek.js";

/**
 * @typedef {object} ReadOptions
 * @property {string} file - file
 * @property {string} [delimiter] - comma, tab, pipe
 * @property {string} [header] - true
 * @property {string} [quoted] - double, single
 * @property {any} [fileCache] - is Cache enabled
 * @property {any} [fileCatch]
 *
 * @typedef {object} WriteOptions
 * @property {string} [file]
 * @property {string[]} [header]
 * @property {number} [space]
 * @property {any} [raw]
 * @property {string} [suffix] - fileName suffix [file.{suffix}.ext] eg. .v0
 *
 * @typedef {Object} TypeOfSettings
 * @property {ReadOptions} query
 * @property {any} header
 * @property {string} separator
 * @property {string} linebreak
 *
 * @typedef {function(string,number):any} ModifierCallback
 * @typedef {function(any):any} DoneCallback
 */

/**
 * Store in memory
 * @todo readJSON, readFlat
 * @type {Object.<string,any>}
 */
const cacheData = {};

/**
 * Read/Write for known flat files. eg. csv, tsv and etc.
 */
export default class flat {
  /**
   * @private
   * @type {TypeOfSettings}
   */
  settings = {
    query: { file: "" },
    header: [],
    separator: "",
    linebreak: "\r\n",
  };

  /**
   * @private
   * @type {any}
   */
  _fileData = [];

  /**
   * @private
   * @type {any}
   */
  _fileId = undefined;

  /**
   * @param {ReadOptions} query
   * @description what
   * @example
   * const csv = new flat({file:"test.csv"});
   * csv.readFlat.on("finish", () => {
   *  console.log("finish", csv.data);
   *  csv.writeFlat();
   * });
   *
   * const tsv = new flat({file:"test.tsv"});
   * tsv.readFlat.on("finish", () => {
   *  console.log("finish", tsv.data);
   * });
   *
   * const json = new flat({file:"test.json"});
   * json.readJSON().then(function(data) {
   *  json.writeFlat({ file: "test.tsv" });
   * });
   *
   * const csv = new flat({file:"test.csv"});
   * const reader = csv.readFlat({
   *  modifier: function(str) {
   *    return burglish(str).toUnicode;
   *  },
   * });
   *
   * reader.on("cell", (cell) => {
   *  console.log("cell", cell);
   * });
   *
   * reader.on("row", (row) => {
   *  console.log("row", row);
   * });
   *
   * reader.on("finish", () => {
   *  console.log("finish", csv.data);
   * });
   */
  constructor(query) {
    this.settings.query = query;
  }

  /**
   * get file name
   */
  get fileName() {
    return this.settings.query.file;
  }

  /**
   * Make Id from filename without extension and last directory name
   * @returns {any} as expected it return [string], but for futher use in JSDoc it return type as any!
   */
  get id() {
    if (!this._fileId) {
      let filePath = path.parse(this.settings.query.file);
      let lastItem = filePath.dir.substring(filePath.dir.lastIndexOf("/") + 1);
      this._fileId = filePath.name + lastItem;
    }
    return this._fileId;
  }

  /**
   * Check file exists
   * @param {string} [file]
   */
  fileExists(file) {
    return seek.exists(file || this.settings.query.file);
  }

  /**
   * file watch
   * param {string} [file]
   * @param {()=>any} callback
   */
  fileWatch(callback) {
    seek.watch(this.settings.query.file, callback);
  }

  /**
   * Read by line
   * @param {{modifier?:ModifierCallback, flags?:string}} on - {flags:[wx,r,w]}
   */
  readFlat(on = {}) {
    const stream = seek.readStream(this.settings.query.file, {
      flags: on.flags,
    });

    // stream.on("error", (e) => {
    //   console.log("stream error", e);
    // });
    const readline = seek.readline.createInterface({
      input: stream,
    });
    const delimiter = delimiters(this.settings);

    readline.on("line", (str) => {
      const raw = str.match(delimiter);

      if (raw) {
        if (this.settings.query.header) {
          if (Object.keys(this.settings.header).length == 0) {
            this.settings.header = raw;
            return;
          }
        }

        const row = this.rowModifier({
          row: raw,
          type: Object.keys(this.settings.header).length == 0,
          modifier: on.modifier,
          callback: function (val) {
            readline.emit("cell", val);
            return val;
          },
        });
        if (row) {
          readline.emit("row", row);
          this.raw.push(row);
        }
      }
    });

    readline.on("close", () => {
      readline.emit("finish", this.raw);
    });

    return readline;
  }

  /**
   * Create array of strings or object with key and value
   * @private
   * @param {{row: RegExpMatchArray | null; type:boolean; modifier?:ModifierCallback, callback:function(string):any}} o
   */
  rowModifier(o) {
    /**
     * @type {any}
     */
    const res = o.type ? [] : {};
    if (o.row) {
      for (var index = 0; index < o.row.length; index++) {
        let raw = o.row[index].replace(/^["']|["']$/g, "");
        if (o.modifier) {
          raw = o.modifier(raw, index);
        }
        if (raw) {
          raw = o.callback(raw);
          if (raw) {
            if (o.type) {
              res.push(raw);
            } else {
              const name = this.settings.header[index];
              res[name] = raw;
            }
          }
        }
      }
      return res;
    }
  }

  /**
   * Read JSON - array with unique data row
   * template T - return if error, if success return [T] type JSDoc
   * param {{fileCatch?:T}} [options]
   * returns {Promise<T>}
   */
  async readJSON() {
    let id = this.id;
    if (!cacheData[id] || !this._fileData) {
      this.raw = await seek.readJSON(
        this.settings.query.file,
        this.settings.query.fileCatch
      );
      if (this.settings.query.fileCache) {
        cacheData[id] = this.raw;
      }
    } else if (cacheData[id]) {
      this.raw = cacheData[id];
    }

    return this.raw;
  }

  get raw() {
    if (this.settings.query.fileCache) {
      return cacheData[this.id];
    }
    return this._fileData || this.settings.query.fileCatch;
  }

  set raw(raw) {
    this._fileData = raw;
    if (this.settings.query.fileCache) {
      cacheData[this.id] = raw;
    }
  }

  /**
   * @private
   * @param {WriteOptions} options
   */
  outputFile(options) {
    var file = this.settings.query.file;
    if (options.file) {
      file = options.file;
    }

    // file = file.replace(/(\.[^/.]+$)/, ".v0$1");
    // file = file
    //   .replace(/(\.[^/.]+$)/, ".options.suffix$1")
    //   .replace("options.suffix", options.suffix || "v0");
    file = file
      .replace(/(\.[^/.]+$)/, "options.suffix$1")
      .replace("options.suffix", options.suffix || "");

    return (this.settings.query.file = file);
  }

  /**
   * write flat file from data
   * @param {WriteOptions} options
   */
  writeFlat(options = {}) {
    const file = this.outputFile(options);

    if (this.settings.separator == "") {
      delimiters(this.settings);
    }
    const raw = options.raw || this.raw;

    const writer = seek.writeStream(file);
    // this.settings.header = header | header;
    if (options.header?.length) {
      this.settings.header = options.header;
    }
    if (Object.keys(this.settings.header).length) {
      writer.write(this.settings.header.join(this.settings.separator));
      writer.write(this.settings.linebreak);
    }
    for (var index = 0; index < raw.length; index++) {
      const obj = raw[index];
      let row = "";
      if (typeof obj == "object") {
        row = Object.values(obj).join(this.settings.separator);
      } else {
        row = obj.join(this.settings.separator);
      }
      writer.write(row);
      writer.write(this.settings.linebreak);
    }

    return writer.end();
  }

  /**
   * @param {{file?:string, raw?:any, space?:number, suffix?:string}} options
   */
  async writeJSON(options = {}) {
    const file = this.outputFile(options);
    const raw = options.raw || this.raw;
    return await seek.writeJSON(file, raw, options.space);
  }
}

/**
 * @param {TypeOfSettings} settings
 */
function delimiters(settings) {
  var delimiter = settings.query.delimiter;
  if (!delimiter) {
    const extension = settings.query.file.split(".").pop();
    delimiter = extension == "tsv" ? "tab" : "comma";
  }
  switch (delimiter) {
    case "tab":
      settings.separator = "\t";
      if (settings.query.quoted == "single") {
        return /('[^']*')|[^\t]+/g;
      }
      return /("[^"]*")|[^\t]+/g;
    case "pipe":
      settings.separator = "|";
      if (settings.query.quoted == "single") {
        return /('[^']*')|[^|]+/g;
      }
      return /("[^"]*")|[^|]+/g;

    default:
      settings.separator = ",";
      // stackoverflow.com/questions/11456850/split-a-string-by-commas-but-ignore-commas-within-double-quotes-using-javascript
      if (settings.query.quoted == "single") {
        return /('[^']*')|[^,]+/g;
      }
      return /("[^"]*")|[^,]+/g;
  }
}
