```js
score.db.query('SELECT * FROM ?? WHERE ip LIKE ? ORDER BY ip ASC',['visits','127.0.0.1']).then(raw=>{
  if (raw.length > 0) {
    console.log(raw);
  }
});
```