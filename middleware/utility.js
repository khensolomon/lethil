module.exports = {
  error:function(req, res){
    res.status(404).send('Not Found');
  },
  notfound:function(req, res){
    res.status(404).send('Not Found');
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

    if(res.locals.forceHTTPS){
      return res.writeHead(301, { "Location": "https://" + host + req.url })
    } else if (redirect){
      return res.redirect(301, req.protocol + '://' + host + req.url)
    }
    next();
  },
  restrict:function(req, res, next){
    next();
  }
};