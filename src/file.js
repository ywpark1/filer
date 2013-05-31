define(function(require) {

  var _ = require('lodash');

  var normalize = require('src/path').normalize;
  var dirname = require('src/path').dirname;
  var basename = require('src/path').basename;

  var MODE_FILE = require('src/constants').MODE_FILE;

  var guid = require('src/shared').guid;
  var hash = require('src/shared').hash;

  var read_object = require('src/object-store').read_object;
  var write_object = require('src/object-store').write_object;
  var delete_object = require('src/object-store').delete_object;
  var find_node = require('src/object-store').find_node;

  var O_READ = require('src/constants').O_READ;
  var O_WRITE = require('src/constants').O_WRITE;
  var O_CREATE = require('src/constants').O_CREATE;
  var O_EXCLUSIVE = require('src/constants').O_EXCLUSIVE;
  var O_TRUNCATE = require('src/constants').O_TRUNCATE;
  var O_APPEND = require('src/constants').O_APPEND;
  var O_FLAGS = require('src/constants').O_FLAGS;

  var EInvalid = require('src/error').EInvalid;

  function DirectoryEntry(id, type) {
    this.id = id;
    this.type = type || MODE_FILE;
  };

  function Node(id, mode, size, atime, ctime, mtime, flags, xattrs, links, version) {
    var now = Date.now();

    this.id = id || hash(guid()),
    this.mode = mode || MODE_FILE;  // node type (file, directory, etc)
    this.size = size || 0; // size (bytes for files, entries for directories)
    this.atime = atime || now; // access time
    this.ctime = ctime || now; // creation time
    this.mtime = mtime || now; // modified time
    this.flags = flags || []; // file flags
    this.xattrs = xattrs || {}; // extended attributes
    this.links = links || 0; // links count
    this.version = version || 0; // node version
    this.data = hash(this.id) // id for data object
  };

  function open_file(objectStore, path, flags, callback) {
    path = normalize(path);
    var name = basename(path);
    var parentPath = dirname(path);

    var directoryNode;
    var directoryData;
    var fileNode;
    var fileData;

    if(!_(O_FLAGS).has(flags)) {
      return callback(new EInvalid('flags is not valid'));
    } else {
      flags = O_FLAGS[flags];
    }

    find_node(objectStore, parentPath, read_directory_data);

    function read_directory_data(error, result) {
      if(error) {
        callback(error);
      } else {
        directoryNode = result;
        read_object(objectStore, directoryNode.data, check_if_file_exists);
      }
    };

    function check_if_file_exists(error, result) {
      if(error) {
        callback(error);
      } else {
        directoryData = result;
        if(_(directoryData).has(name)) {
          if(_(flags).contains(O_EXCLUSIVE)) {
            callback(new ENoEntry('O_CREATE and O_EXCLUSIVE are set, and the named file exists'))
          }
        } else {
          if(!_(flags).contains(O_CREATE)) {
            callback(new ENoEntry('O_CREATE is not set and the named file does not exist'));
          } else {
            write_file_node();
          }
        }
      }
    };

    function write_file_node() {
      fileNode = new Node(undefined, MODE_FILE);
      fileNode.links += 1;
      write_object(objectStore, fileNode, fileNode.id, write_file_data);
    };

    function write_file_data(error) {
      if(error) {
        callback(error);
      } else {
        fileData = {};
        write_object(objectStore, fileData, fileNode.data, update_directory_data);
      }
    };

    function update_directory_data(error) {
      if(error) {
        callback(error);
      } else {
        directoryData[name] = new DirectoryEntry(fileNode.id, MODE_FILE);
        write_object(objectStore, directoryData, directoryNode.data, create_file_descriptor);
      }
    };

    function create_file_descriptor(error) {
      if(error) {
        console.log(error);
      } else {
        callback(undefined, '!');
      }
    };
  };

  return {
    Node: Node,
    open_file: open_file,
    DirectoryEntry: DirectoryEntry,
  };

});