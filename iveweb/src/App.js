import { NodeEditor } from "flume";
import { FlumeConfig } from 'flume'
import { useCallback, useState } from 'react';
import './App.css';
import { http_get, http_post } from './HTTPGetPost'
import { IVEController } from "./IVEController";
import { IVEInterface } from "./IVEInterface_remote";
import IVEManip from "./IVEManip";

const ToFlumePort = port => ({
  name: port.Name,
  label: port.Name,
  color: 'green'
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
    removeNode: id => api.removeNode(id)
  }
}

function App() {
  const [nodetypes, setNodeTypes] = useState([]);
  const [uiEvents, setUIEvents] = useState([]);

  const apiCallback = useCallback(async api => {
    // Create a controller and then subscribe to the graph changes
    const remote = IVEInterface(http_get, http_post);
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

    // Create a manipulator and controller
    const manip = await IVEManip(localStorage, remote);
    const controller = await IVEController(FlumeAPIToControllerAPI(api), manip);

    // Bind our uievents into the controller
    const uiEvents = {
      addNodeRequest: (type, x, y) => controller.createRequest(type, x, y),
      deleteNodeRequest: id => controller.removeRequest(id)
    }
    setUIEvents(uiEvents);
  }, [])

  return (
    <div className="App">
      <div style={{ width: 1600, height: 900 }}>
        <NodeEditor
          nodeTypes={nodetypes}
          apiCallback={apiCallback}
          uiEvents={uiEvents}
        />
      </div>

    </div>
  );
}

export default App;
