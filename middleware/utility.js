module.exports = {
  error:function(req, res){
    // res.status(404).send('Not Found');
    res.status(404).end();
  },
  notfound:function(req, res){
    // res.status(404).send('Not Found');
    res.status(404).end();
  },
  // NOTE: forceWWW, forceHTTPS
  redirect:function(req, res, next){
    var host = req.headers.host,redirect=false;
    if (res.locals.forceWWW){
      if (!host.match(/^www./)) {
        host = 'www.'+host;
        redirect=true;
      }
    } else {
      if (host.match(/^www./)) {
        host = host.slice(4);
        redirect=true;
      }
    }
    // res.writeHead(301, { "Location": "https://google.com" });
    // return res.end();


    if(res.locals.forceHTTPS){
      res.writeHead(301, { "Location": "https://" + host + req.url })
      res.end();
      // res.redirect(301, { "Location": "https://" + host + req.url })
    } else if (redirect){
      res.redirect(301, req.protocol + '://' + host + req.url)
      res.end();
    } else {
      next();
    }
  },
  restrict:function(req, res, next){
    next();
  }
};