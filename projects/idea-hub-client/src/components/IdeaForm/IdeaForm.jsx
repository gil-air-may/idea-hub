import React from "react";
import PropTypes from "prop-types";
import IPFS from "ipfs";
import classes from "./IdeaForm.module.css";
import Dropzone from "react-dropzone-uploader";
const wrtc = require("wrtc"); // or require('electron-webrtc')()
const WStar = require("libp2p-webrtc-star");
const wstar = new WStar({ wrtc });
const OrbitDB = require("orbit-db");
const DB_ADDRESS =
  "/orbitdb/zdpuArDkTiMgYZmwBXjsMkTe3DmDv1kwfpYJh9sjvangzBEXo/test5";

const PUBLIC_GATEWAY = "https://ipfs.io/ipfs";

class IdeaForm extends React.Component {
  constructor(props, context) {
    super(props);
    this.handleChange = this.handleChange.bind(this);
    this.uploadIdeaToIPFS = this.uploadIdeaToIPFS.bind(this);
    this.publishFileHash = this.publishFileHash.bind(this);
    //browser node setup
    this.ipfsNode = new IPFS({
      EXPERIMENTAL: { pubsub: true },
      relay: { enabled: true, hop: { enabled: false } },
      config: {
        Addresses: {
          Swarm: [
            "/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star"
          ]
        },
        libp2p: {
          modules: {
            transport: [wstar],
            peerDiscovery: [wstar.discovery]
          }
        }
      }
    });

    this.state = {
      ipfsOptions: {
        id: null,
        version: null,
        protocol_version: null
      },
      value: "",
      added_file_hash: "",
      added_file_contents: ""
    };
  }

  componentDidMount() {
    this.ipfsNode.once("ready", async () => {
      await this.ipfsNode.swarm.connect(
        "/dns4/0.tcp.ngrok.io/tcp/15968/ws/ipfs/QmRHLtKEYxTwJaL9K4RNL4fp2vFL9Z1p7LVpdpdHvS7zSb"
      );

      this.ipfsNode.id((err, res) => {
        if (err) {
          throw err;
        }
        console.log(res);
        this.setState({
          ipfsOptions: {
            id: res.id,
            version: res.agentVersion,
            protocol_version: res.protocolVersion
          }
        });
      });
    });
  }

  saveToOrbitDB = async () => {
    const options = {
      // Give write access to everyone
      accessController: {
        write: ["*"]
      }
    };

    const orbitdb = await OrbitDB.createInstance(this.ipfsNode);
    const db = await orbitdb.log("test5", options);
    await db.load();
    console.log("DB LOADED, ADDRESS:");
    console.log(db.address.toString());
    await db.add({
      address: "alskdjalkjdhaslkjhaksjh",
      file_hash: "alksjdhalksjhdaklsjhadsklj"
    });
    console.log("DB ENTRY ADDED");
  };

  fetchFromOrbitDB = async () => {
    const orbitdb = await OrbitDB.createInstance(this.ipfsNode);
    const db = await orbitdb.eventlog(DB_ADDRESS);
    await db.load();
    console.log("STARTING FETCH...");
    const all = db
      .iterator({ limit: -1 })
      .collect()
      .map(e => e.payload.value);
    console.log("SAVED VALUES ARE");
    console.log(all);
  };

  // called every time a file's `status` changes
  handleChangeStatus = ({ meta, file }, status) => {
    console.log(status, meta, file);
  };

  // receives array of files that are done uploading when submit button is clicked
  handleSubmit = files => {
    files.map(file => {
      const reader = new window.FileReader();
      reader.readAsArrayBuffer(file.file);
      reader.onloadend = () => {
        /* this.saveToIpfs(Buffer(reader.result)); */
        /* You must use file.file to get the blob  */
        this.uploadIdeaToIPFS(Buffer(reader.result));
      };
    });
  };

  uploadIdeaToIPFS(file) {
    console.log("inside uploadIdeaToIPFS...");
    this.ipfsNode.add(file, (err, filesAdded) => {
      if (err) {
        throw err;
      }

      const hash = filesAdded[0].hash;
      this.setState(
        {
          added_file_hash: hash
        },
        () => {
          this.publishFileHash();
        }
      );
    });
  }

  async publishFileHash() {
    const orbitdb = await OrbitDB.createInstance(this.ipfsNode);
    const db = await orbitdb.log(DB_ADDRESS);
    await db.load();
    console.log("DB LOADED, ADDRESS:");
    console.log(db.address.toString());
    await db.add({
      address: this.context.web3.selectedAccount,
      file: this.state.added_file_hash
    });
    console.log("DB ENTRY ADDED");
  }

  getValidationState() {
    const length = this.state.value.length;
    if (length > 10) return "success";
    else if (length > 5) return "warning";
    else if (length > 0) return "error";
    return null;
  }

  handleChange(e) {
    this.setState({ value: e.target.value });
  }

  /**
   * web3Context = {
   *   accounts: {Array<string>} - All accounts
   *   selectedAccount: {string} - Default ETH account address (coinbase)
   *   network: {string} - One of 'MAINNET', 'ROPSTEN', or 'UNKNOWN'
   *   networkId: {string} - The network ID (e.g. '1' for main net)
   * }
   */

  render() {
    return (
      <div className={classes.UploadContainer}>
        <div className={classes.InfoBox}>
          <h1>Connected to ethereum and ipfs network!</h1>
          <p>Ethereum network: {this.context.web3.network}</p>
          <p>
            Your IPFS version is{" "}
            <strong>{this.state.ipfsOptions.version}</strong>
          </p>
          <p>
            Your IPFS protocol version is{" "}
            <strong>{this.state.ipfsOptions.protocol_version}</strong>
          </p>
          <hr />
          <p>
            Using your ethereum account: {this.context.web3.selectedAccount}
          </p>
          <p>
            Your IPFS ID is <strong>{this.state.ipfsOptions.id}</strong>
          </p>
          <hr />
          <p>Submitted Idea's IPFS hash: {this.state.added_file_hash}</p>
          <p>Submitted Idea's content: {this.state.added_file_contents}</p>
          <p>
            Checkout the uploaded idea at: {PUBLIC_GATEWAY}/
            {this.state.added_file_hash}
          </p>
          <button onClick={e => this.saveToOrbitDB()}>
            Test Save toOrbit DB
          </button>
          <button onClick={e => this.fetchFromOrbitDB()}>
            Test Fetch from Orbit DB
          </button>
          <hr />
        </div>
        <div className={classes.Upload}>
          <Dropzone
            styles={{
              dropzone: {
                overflow: "hidden",
                borderStyle: "none"
              }
            }}
            onChangeStatus={this.handleChangeStatus}
            onSubmit={this.handleSubmit}
            accept="image/*, .pdf"
          />
          <div className={classes.Square} />
        </div>
      </div>
    );
  }
}

IdeaForm.contextTypes = {
  web3: PropTypes.object
};

export default IdeaForm;
