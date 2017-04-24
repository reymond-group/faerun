var FaerunConfig = {
  "colors": {
    colorpickerDialogProject: [
      '#3498db', '#2980b9',
      '#1abc9c', '#16a085',
      '#2ecc71', '#27ae60',
      '#f1c40f', '#f39c12',
      '#e67e22', '#d35400',
      '#e74c3c', '#c0392b',
      '#9b59b6', '#8e44ad',
      '#ecf0f1', '#bdc3c7',
      '#95a5a6', '#7f8c8d',
      '#34495e', '#2c3e50'
    ]
  },
  "server": {
    "url": 'ws://underdark.gdb.tools/underdark'
  },
  "services": {
    "fpUrls": {
      "mqn": "http://gdbtools.unibe.ch:8080/fpService/calculateFP2.jsp?smi={0}&fp=MQN",
      "apfp": "http://gdbtools.unibe.ch:8080/fpService/calculateFP2.jsp?smi={0}&fp=APfp",
      "xfp": "http://gdbtools.unibe.ch:8080/fpService/calculateFP2.jsp?smi={0}&fp=Xfp",
      "smifp": "http://gdbtools.unibe.ch:8080/fpService/calculateFP2.jsp?smi={0}&fp=SMIfp",
      "sfp": "http://gdbtools.unibe.ch:8080/fpService/calculateFP2.jsp?smi={0}&fp=Sfp",
      "ecfp4": "http://gdbtools.unibe.ch:8080/fpService/calculateFP2.jsp?smi={0}&fp=ECfp4"
    },
    "pcaUrl": "http://planes.gdb.tools/",
    "pcaParameters": {
      "mqn": {
        "database": "surechembl",
        "fingerprint": "mqn",
        "dimensions": 3,
        "binning": true,
        "resolution": 250
      },
      "apfp": {
        "database": "surechembl",
        "fingerprint": "apfp",
        "dimensions": 3,
        "binning": true,
        "resolution": 250
      },
      "smifp": {
        "database": "surechembl",
        "fingerprint": "smifp",
        "dimensions": 3,
        "binning": true,
        "resolution": 250
      }
    }
  }
}
