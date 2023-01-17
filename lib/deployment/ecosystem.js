import path from "path";
import { config, load, seek } from "../lethil.js";

/**
 * Purely for deployment from local/workspace, which
 * create or update `ecosystem.json` based on `origin-ecosystem.json` using `.env` and `package.json`
 * used by `node run ecosystem`
 * @example
 * node run ecosystem
 * npm run deployment:ecosystem
 * @description PM2 `ecosystem.json` should should not be modified directly
 * @param {any} _req
 */
export async function createOrUpdate(_req) {
  // const packageJSON = load.json(config.dir.root, "package.json");
  const fileName = "ecosystem.json";
  const ecosystemJSON = load.json(
    config.dir.root,
    "origin-?".replace("?", fileName)
  );

  ecosystemJSON["help"] = {
    note: "Do not modify this file directly!",
    created_date: new Date(),
    // oops: {},
  };

  if (seek.exists(path.join(config.dir.root, fileName))) {
    const old = load.json(config.dir.root, fileName);
    ecosystemJSON.help.created_date = old.help.created_date;
    ecosystemJSON.help.updated_date = new Date();
    if (old.help.hasOwnProperty("modified")) {
      ecosystemJSON.help.modified = old.help.modified + 1;
    } else {
      ecosystemJSON.help.modified = 1;
    }
  }
  /**
   * @type {string[]}
   */
  const noProperty = [];

  const ecosystem = JSON.stringify(ecosystemJSON, null, 2).replace(
    /(\<)(\w+)(\>)/g,
    /**
     *
     * @param {*} _match
     * @param {*} _p1
     * @param {string} p2
     * @param {*} _p3
     */
    function (_match, _p1, p2, _p3) {
      // NOTE: .env has the property of the p2
      if (config.hasOwnProperty(p2)) {
        // @ts-ignore
        return config[p2];
      }

      const packName = p2.split("_").map((e) => e.toLowerCase());

      // NOTE: package.json has the property [env] and containing the p2 Objectkey
      if (config.hasOwnProperty("env")) {
        /**
         * @type {any} objectProperty
         */
        var objectProperty = config["env"];
        for (const [_i, value] of packName.entries()) {
          if (objectProperty.hasOwnProperty(value)) {
            objectProperty = objectProperty[value];
          } else {
            objectProperty = null;
            break;
          }
        }
        if (objectProperty) {
          return objectProperty;
        }
      }

      if (p2 == "APP_NAME") {
        return config.name;
      }
      // if (packageJSON.hasOwnProperty("env")) {
      //   var objectProperty = packageJSON["env"];
      //   for (const [_i, value] of packName.entries()) {
      //     if (objectProperty.hasOwnProperty(value)) {
      //       objectProperty = objectProperty[value];
      //     } else {
      //       objectProperty = null;
      //       break;
      //     }
      //     // if (i === packName.length - 1) {}
      //   }

      //   if (objectProperty) {
      //     return objectProperty;
      //   }
      // }

      // NOTE: package.json has the property of the p2 Objectkey
      // var objectProperty = packageJSON;
      // for (const [_i, value] of packName.entries()) {
      //   if (
      //     objectProperty.hasOwnProperty(value) &&
      //     typeof objectProperty[value] == "string"
      //   ) {
      //     objectProperty = objectProperty[value];
      //   } else {
      //     objectProperty = null;
      //     break;
      //   }
      // }
      // if (objectProperty) {
      //   return objectProperty;
      // }

      noProperty.push(p2);

      return p2;
    }
  );

  // await seek.write(path.join(config.dir.root, fileName), ecosystem);

  return seek
    .write(path.join(config.dir.root, fileName), ecosystem)
    .then(function (_e) {
      const msg = ecosystemJSON.help.modified > 1 ? "Updated" : "Created";
      const result = [[`${msg} ${fileName}`], [`See ${fileName} if certified`]];
      var status = "with no issue.";

      if (noProperty.length) {
        const noneValue = [...new Set(noProperty)].join(", ");
        status = `but no property found for ${noneValue}`;
      }
      result[0].push(status);

      return result.map((e) => e.join(", ")).join("\n    ");
    })
    .catch(function (e) {
      return e;
    });
}
