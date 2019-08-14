module.exports = {
  http:function(req, res, next){
    res.status(404).send('Not Found\n:)')
  }
};