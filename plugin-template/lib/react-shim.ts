const R = (globalThis as any).React;
export default R;
export const {
  useState, useEffect, useRef, useCallback, useMemo,
  useReducer, useContext, createContext, memo, forwardRef,
  Fragment,
} = R;
