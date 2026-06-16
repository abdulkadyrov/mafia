import React from "react";

function stableSerialize(value: unknown) {
  return JSON.stringify(value);
}

export function areEqualByValue<T>(left: T, right: T) {
  return stableSerialize(left) === stableSerialize(right);
}

export function setIfChanged<T>(
  setState: React.Dispatch<React.SetStateAction<T>>,
  nextValue: T
) {
  setState((currentValue) =>
    areEqualByValue(currentValue, nextValue) ? currentValue : nextValue
  );
}
