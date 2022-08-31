import { NodeEditor } from "flume";
import { FlumeConfig } from 'flume'
import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { http_get, http_post } from './HTTPGetPost'
import { IVEController } from "./IVEController";
import { IVEInterface } from "./IVEInterface_remote";
import IVEManip from "./IVEManip";

import { Colors } from 'flume';
import InspectorTap from "./InspectorTap";
const colors = {
  'Double': Colors.blue,
  'Int32': Colors.green,
  'String': Colors.red,
  'Boolean': Colors.orange,
};


const ToFlumePort = port => ({
  name: port.Name,
  label: port.Name,
  color: colors[port.Kind]
})

const ToFlumeType = node => ({
  type: "custom",
  label: node.Kind,
  description: "NO DESCRIPTION",
  inputs: node.Inputs.map(ToFlumePort),
  outputs: node.Outputs.map(ToFlumePort),
  initialWidth: 100
})

const FlumeAPIToControllerAPI = api => {
  return {
    addNode: node => api.addNode({
      id: node.Id,
      nodeType: ToFlumeType(node),
      inputData: true,
      x: node.x,
      y: node.y
    }),
    removeNode: id => api.removeNode(id),
    connect: (fromid, fromport, toid, toport) => api.addConnection(fromid, fromport, toid, toport),
    disconnect: (fromid, fromport, toid, toport) => api.removeConnection(fromid, fromport, toid, toport),
    selectNode: id => api.updateProperties(id, { "data-node-selected": "true" }),
    deselectNode: id => api.updateProperties(id, { "data-node-selected": "false" }),
    info: str => api.showToast("info",str,"info",4000)
  }
}

function App() {
  const [nodetypes, setNodeTypes] = useState([]);
  const [uiEvents, setUIEvents] = useState([]);
  const [inspector, setInspector] = useState([]);
  const [tap, setTap] = useState(null);
  const [setNodeState, setSetNodeState] = useState(null);

  const apiref = useRef(null);

  const apiCallback = useCallback(async api => {
    apiref.current = api;
    // Create a controller and then subscribe to the graph changes
    const downstream_remote = IVEInterface(http_get, http_post);

    // Embed a persistant save in the middle

    // Create a tap for setting the graph
    // This is wonky way to patch the setting of a graph.
    // And serialize it.
    const tap = await InspectorTap(downstream_remote.setGraph);
    setTap(tap);
    const remote = {
      getTypes: downstream_remote.getTypes,
      getTypeInfo: downstream_remote.getTypeInfo,
      setGraph: tap.setGraph
    }

    // Get the types and setup our types in the UI
    var types = await remote.getTypes();
    const config = new FlumeConfig();
    // foreach type 
    for (const t of types) {
      config.addNodeType({
        type: t,
        label: t,
        deletable: false
      });
    }
    setNodeTypes(config.nodeTypes);

    const inspectorapi = {
      show: nodes => setInspector(nodes)
    }

    // Create a manipulator and controller
    const manip = await IVEManip(localStorage, remote);
    const controller = await IVEController(FlumeAPIToControllerAPI(api), manip, inspectorapi);

    // Bind our uievents into the controller
    const uiEvents = {
      addNodeRequest: (type, x, y) => controller.createRequest(type, x, y),
      deleteNodeRequest: id => controller.removeRequest(id),
      portConnectRequest: (fromid, fromport, toid, toport) => controller.portConnectRequest(fromid, fromport, toid, toport),
      portDisconnectRequest: (fromid, fromport, toid, toport) => controller.portDisconnectRequest(fromid, fromport, toid, toport),
      nodeClicked: id => controller.nodeClicked(id),
      nodeMoved: (id, x, y) => controller.nodeMoved(id, x, y),
      stageClicked: () => controller.stageClicked()
    }
    setUIEvents(uiEvents);

    setSetNodeState(() => (id,state) => { // Wonky double function to deal with the useState using a function to set it, but we want to set it to a function
      //console.log("Actuallying setting node state" + id + " " + state)
      controller.setNodeState(id, state);
    })

    return () => {
      console.log("App unmounting")
      tap.dispose();
    }
  }, [])

  const showToast = () => {
    apiref.current.info("title","message","info",4000);
  }

  return (
    <div className="App">
      <div style={{ width: '100%', height: 900 }}>
        <NodeEditor
          nodeTypes={nodetypes}
          apiCallback={apiCallback}
          uiEvents={uiEvents}
        />
      </div>
      <button onClick={showToast}>Show Toast</button>
      {tap ? <Inspector tap={tap} nodes={inspector} setState={setNodeState}/> : null}
    </div>
  );
}

const Port = (p, value) => (
  <div key={p.Name}>{p.Name} - {p.Kind} = {value ? value : "UNKNOWN"}</div>
)

const SetState = ({ node, initial_value, onSetState }) => {
  const [value, setValue] = useState(initial_value);

  const KeyDown = e => {
    // if they pressed enter
    if (e.key === 'Enter') {
      onSetState(value);
    }
  }

  return (<div>
    Set: <input value={value} onChange={e => setValue(e.target.value)} onKeyDown={KeyDown} />
  </div>)
}

const ShowNode = ({ node, tap, setState }) => {
  const [portvalues, setPortValues] = useState(undefined);

  useEffect(() => {
    const sub = tap.tap(node.Id, data => {
      //console.log("Got data from tap for node", node.Id, data);
      setPortValues(data);
    })
    return sub;
  }, [node, tap])

  const value = p => portvalues ? portvalues[p.Name] : "Retrieving...";

  const isValueKind = node.Kind.match(/^Value-[a-zA-Z0-9]+Value$/);

  const onSetState = value => {
    const trimmedvalue = value.trim();
    setState(node.Id, trimmedvalue);
  }

  return (
    <div>
      <div>{node.Kind}</div>
      {(isValueKind && portvalues?.output) ? (<SetState node={node} onSetState={onSetState} initial_value={JSON.parse(portvalues.output)} />) : null}
      <h2>Inputs</h2>
      <div>{node.Inputs.map(p => Port(p))}</div>
      <h2>Outputs</h2>
      <div>{node.Outputs.map(p => Port(p, value(p)))}</div>
    </div>
  )
}

const Inspector = ({ nodes, tap, setState }) => {
  return (
    <div className='inspector' style={{ minWidth: 200, minHeight: 200, position: 'absolute', left: 0, top: 0, border: '1px solid gray' }}>
      <h1>Inspector</h1>
      {nodes.map(node => (<ShowNode key={node.Id} tap={tap} node={node} setState={setState} />))}
    </div>
  )
}

export default App;
