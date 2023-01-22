import "mocha";
import * as assert from "assert";
import { check } from "../lethil.mjs";

// import {command, default as set} from '../lib/lethil.js';

// /**
//  * Replace all
//  * @param {string} str
//  * @returns {string}
//  */
// function simple_validation(str) {
// 	// NOTE: Simple validation: string
// 	// return str.replace(/(\<)(.*?)(\>)/g, "");

// 	// NOTE: Simple validation: encoded
// 	str = str.replace(/(\<|%3C)(.*?)(\>|%3E)/g, "");

// 	return str;
// }

describe("check.isValid(str): XSS query", () => {
  it("Simple validation: string", () => {
    const script_replaced = check.isValid("<script></script>");
    assert.strictEqual("", script_replaced);

    const img_replaced = check.isValid("<img></img>");
    assert.strictEqual("", img_replaced);

    const any_img_replaced = check.isValid("<img></img><button><script>");
    assert.strictEqual("", any_img_replaced);

    const no_attr_allow = check.isValid(
      "<img onerror=\"l.h='https://example.com/'\" src=x>"
    );
    assert.strictEqual("", no_attr_allow);
  });

  it("Simple validation: encoded", () => {
    assert.strictEqual(
      "",
      check.isValid(
        "%3Cimg+src%3Dx+onerror%3D%22location.href%3D%27https%3A%2F%2Fexample.com%2F%27%22%3E"
      )
    );
    assert.strictEqual(
      "",
      check.isValid(
        "<img+src%3Dx+click%3D%22location.href%3D%27https%3A%2F%2Fexample.com%2F%27%22>"
      )
    );
    assert.strictEqual(
      "",
      check.isValid(
        "<img src=x onerror=\"location.href='https://example.com/'\">"
      )
    );
    assert.strictEqual(
      "",
      check.isValid(
        "<img+src%3Dx+onerror%3D%22location.href%3D%27https%3A%2F%2Fexample.com%2F%27%22%3E"
      )
    );
    assert.strictEqual(
      "",
      check.isValid(
        "%3Cimg+src%3Dx+onerror%3D%22location.href%3D%27https%3A%2F%2Fexample.com%2F%27%22>"
      )
    );
  });

  it("Basic XSS", () => {
    assert.strictEqual(
      "",
      check.isValid("<SCRIPT SRC=http://xss.rocks/xss.js></SCRIPT>")
    );
  });

  it("XSS Locator (Polygot)", () => {
    assert.strictEqual(
      "javascript:",
      check.isValid(
        "javascript:/*--></title></style></textarea></script></xmp><svg/onload='+/\"/+/onmouseover=1/+/[*/[]/+alert(1)//'>"
      )
    );
  });

  it("Malformed A Tags", () => {
    assert.strictEqual(
      "",
      check.isValid('<a onmouseover="alert(document.cookie)">xxs link</a>')
    );
    assert.strictEqual(
      "",
      check.isValid("<a onmouseover=alert(document.cookie)>xxs link</a>")
    );
  });

  it("Malformed IMG Tags", () => {
    assert.strictEqual(
      "",
      check.isValid('<IMG """><SCRIPT>alert("XSS")</SCRIPT>">')
    );
    assert.strictEqual(
      "",
      check.isValid("<IMG SRC=javascript:alert(String.fromCharCode(88,83,83))>")
    );
    assert.strictEqual(
      "",
      check.isValid("<IMG SRC=# onmouseover=\"alert('xxs')\">")
    );
    assert.strictEqual(
      "",
      check.isValid("<IMG SRC= onmouseover=\"alert('xxs')\">")
    );
    assert.strictEqual("", check.isValid("<IMG onmouseover=\"alert('xxs')\">"));
    assert.strictEqual(
      "",
      check.isValid(
        '<IMG SRC=/ onerror="alert(String.fromCharCode(88,83,83))"></img>'
      )
    );
    assert.strictEqual(
      "",
      check.isValid(
        '<img src=x onerror="&#0000106&#0000097&#0000118&#0000097&#0000115&#0000099&#0000114&#0000105&#0000112&#0000116&#0000058&#0000097&#0000108&#0000101&#0000114&#0000116&#0000040&#0000039&#0000088&#0000083&#0000083&#0000039&#0000041">'
      )
    );
    assert.strictEqual(
      "",
      check.isValid(
        "<IMG SRC=&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;&#97;&#108;&#101;&#114;&#116;&#40;&#39;&#88;&#83;&#83;&#39;&#41;>"
      )
    );
    assert.strictEqual(
      "",
      check.isValid(
        "<IMG SRC=&#0000106&#0000097&#0000118&#0000097&#0000115&#0000099&#0000114&#0000105&#0000112&#0000116&#0000058&#0000097&#0000108&#0000101&#0000114&#0000116&#0000040&#0000039&#0000088&#0000083&#0000083&#0000039&#0000041>"
      )
    );
    assert.strictEqual(
      "",
      check.isValid(
        "<IMG SRC=&#x6A&#x61&#x76&#x61&#x73&#x63&#x72&#x69&#x70&#x74&#x3A&#x61&#x6C&#x65&#x72&#x74&#x28&#x27&#x58&#x53&#x53&#x27&#x29>"
      )
    );
    assert.strictEqual(
      "",
      check.isValid("<IMG SRC=\"jav ascript:alert('XSS');\">")
    );
  });

  it("Malformed SCRIPT Tags", () => {
    assert.strictEqual("", check.isValid('<<SCRIPT>alert("XSS");//<</SCRIPT>'));
    assert.strictEqual(
      "",
      check.isValid("<SCRIPT SRC=http://xss.rocks/xss.js?< B >")
    );
    assert.strictEqual("", check.isValid("<SCRIPT SRC=//xss.rocks/.j>"));
  });

  it("Malformed <?<|>?> Tags", () => {
    assert.strictEqual(
      "",
      check.isValid("<iframe src=http://xss.rocks/scriptlet.html\n <")
    );
  });
  it("Malformed Expression exp/* Tags", () => {
    assert.strictEqual(
      "exp",
      check.isValid(
        'exp/*<A STYLE=\'no\\xss:noxss("*//*");\n xss:ex/*XSS*//*/*/pression(alert("XSS"))\'>'
      )
    );
  });
});

// javascript:/*--></title></style></textarea></script></xmp><svg/onload='+/"/+/onmouseover=1/+/[*/[]/+alert(1)//'>

// var abc =
//   'exp/*<A STYLE=\'no\\xss:noxss("*//*"); xss:ex/*XSS*//*/*/pression(alert("XSS"))\'>';
