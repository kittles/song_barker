// create one
app.post('/obj-type', (req, res) => {
  return res.send('Received a POST HTTP method');
});
// read one
app.get('/obj-type/:uuid', (req, res) => {
  return res.send('Received a GET HTTP method');
});
// update one
app.put('/obj-type/:uuid', (req, res) => {
  return res.send('Received a PUT HTTP method');
});
// delete one
app.delete('/obj-type/:uuid', (req, res) => {
  return res.send('Received a DELETE HTTP method');
});

// read all
app.get('/obj-type', (req, res) => {
  return res.send('Received a GET HTTP method');
});
