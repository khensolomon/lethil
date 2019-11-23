# mysql

```js
app.sql.query('SELECT * FROM ?? WHERE ip LIKE ? ORDER BY ip ASC',['visits','127.0.0.1']).then(raw=>{
  if (raw.length > 0) {
    console.log(raw);
  }
});


app.sql.query('UPDATE ?? SET plays = plays + 1 WHERE id=?', [table.track,this.param.trackId]);
// return await app.sql.row("SELECT * FROM ?? WHERE id=?;", [table.track,this.param.trackId]);
return app.sql.query('SELECT * FROM ?? WHERE id=?;',  [table.track,this.param.trackId]).then(([row])=>row);
```

## await

```js
const result = await app.sql.query('SELECT * FROM ?? WHERE id=?;',  [table.track,this.param.trackId]).then(
  ([row])=> row
).catch(
  e=>console.log('error',e.message)
);
console.log(result)
```

## join

```js
app.sql.join(
  'UPDATE ?? SET plays = plays + 1 WHERE id=?', [table.track,this.param.trackId]
).then(
  e=>e.query("SELECT * FROM ?? WHERE id=?;", [table.track,this.param.trackId]
  ).then(
    e=> {
      console.log(e)
    }
  )
);

// wait
const result = await app.sql.join(
  'UPDATE ?? SET plays = plays + 1 WHERE id=?', [table.track,this.param.trackId]
).then(
  e=>e.query("SELECT * FROM ?? WHERE id=?;", [table.track,this.param.trackId]
  ).then(
    e=> e
);
console.log(result)
```
