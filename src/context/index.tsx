import { ReactNode, createContext, useReducer, useContext } from 'react';
import { reducer } from './reducer';
import { initializer } from './state';

interface ContextType {
  children: ReactNode;
}

const Context = createContext<any>(undefined);
const Dispatch = createContext<any>(undefined);

const ContextProvider = ({ children }: ContextType) => {
  const [state, dispatch] = useReducer(reducer, initializer);
  return (
    <Context.Provider value={state}>
      <Dispatch.Provider value={dispatch}>{children}</Dispatch.Provider>
    </Context.Provider>
  );
};

// Global accessors
export const useGlobalContext = () => {
  const ctx = useContext(Context);
  if (ctx === undefined) {
    throw new Error('The useGlobalContext hook must be used within a ContextProvider');
  }
  return ctx;
};

export const useDispatch = () => {
  const disp = useContext(Dispatch);
  if (disp === undefined) {
    throw new Error('The useDispatch hook must be used within a Dispatch.Provider');
  }
  return disp;
};

// Ensure named export exists for App.tsx imports
export { ContextProvider };
export default ContextProvider;
