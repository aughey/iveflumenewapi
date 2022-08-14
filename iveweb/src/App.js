import { NodeEditor } from "flume";
import { FlumeConfig } from 'flume'
import { useCallback } from 'react';
import './App.css';
import { http_get, http_post } from './HTTPGetPost'
import { IVEInterface } from "./IVEInterface_remote";

function App() {
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
  }, [])

  return (
    <div className="App">
      <div style={{ width: 1600, height: 900 }}>
        <NodeEditor
          apiCallback={apiCallback}
        />
      </div>

    </div>
  );
}

export default App;
