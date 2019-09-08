module.exports = {
  error:function(req, res, next){
    res.status(404).send('Not Found\n:)')
  },
  notfound:function(req, res, next){
    res.status(404).send('Not Found\n:)')
  },
  secure:function(req, res, next){
    if(res.locals.forceSecure ){
      // res.redirect("https://" + req.headers.host + req.url);
      res.writeHead(301, { "Location": "https://" + req.headers.host + req.url })
      res.end();
    } else {
      next();
    }
  }
};