import * as seek from "../aid/seek.js";

/**
 * @typedef {object} ReadOptions
 * @property {string} file
 * @property {string} [delimiter] - comma, tab, pipe
 * @property {string} [header] - true
 * @property {string} [quoted] - double, single
 *
 * @typedef {object} WriteOptions
 * @property {string} [file]
 * @property {string[]} [header]
 * @property {any} [raw]
 * @property {string} [suffix]
 *
 * @typedef {{query:ReadOptions, header:any,separator:string, linebreak:string}} TypeOfSettings
 *
 * @typedef {function(string,number):any} ModifierCallback
 * @typedef {function(any):any} DoneCallback
 */

class flat {
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
   * @type {any[]}
   */
  data = [];
  /**
   * @param {ReadOptions} param
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
  constructor(param) {
    this.settings.query = param;
  }
  /**
   * Read by line
   * @param {{modifier?:ModifierCallback}} on
   */
  readFlat(on = {}) {
    const stream = seek.readStream(this.settings.query.file);
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
          this.data.push(row);
        }
      }
    });

    readline.on("close", () => {
      readline.emit("finish", this.data);
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
   */
  async readJSON() {
    this.data = await seek.ReadJSON(this.settings.query.file, []);
    return this.data;
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

    file = file
      .replace(/(\.[^/.]+$)/, ".options.suffix$1")
      .replace("options.suffix", options.suffix || "v0");

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
    const raw = options.raw || this.data;

    const writer = seek.writeStream(file);
    // this.settings.header = header | header;
    if (options.header?.length) {
      this.settings.header = options.header;
    }
    const hasHeader = Object.keys(this.settings.header).length;
    if (hasHeader) {
      writer.write(this.settings.header.join(this.settings.separator));
      writer.write(this.settings.linebreak);
    }
    for (var index = 0; index < raw.length; index++) {
      const obj = raw[index];
      let context = "";
      if (typeof obj == "object") {
        if (hasHeader == 0) {
          this.settings.header = Object.keys(obj);
          writer.write(this.settings.header.join(this.settings.separator));
          writer.write(this.settings.linebreak);
        }
        context = Object.values(obj).join(this.settings.separator);
      } else {
        context = obj.join(this.settings.separator);
      }
      writer.write(context);
      writer.write(this.settings.linebreak);
    }

    return writer.end();
  }

  /**
   * @param {{file?:string, raw?:any, space?:number}} options
   */
  async writeJSON(options = {}) {
    const file = this.outputFile(options);
    const raw = options.raw || this.data;
    return await seek.WriteJSON(file, raw, options.space);
  }
  /**
   * readAsFlat
   * writeAsFlat
   * fromJSON
   * fromObject
   * writeJSON
   * write
   */
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

export default flat;
