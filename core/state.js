const prefix = "runlevel:";

function keyFor(key) {
  return `${prefix}${key}`;
}

export function set(key, value) {
  sessionStorage.setItem(keyFor(key), JSON.stringify(value));
}

export function get(key) {
  const value = sessionStorage.getItem(keyFor(key));

  if (value === null) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function remove(key) {
  sessionStorage.removeItem(keyFor(key));
}

export function clear() {
  Object.keys(sessionStorage)
    .filter((key) => key.startsWith(prefix))
    .forEach((key) => sessionStorage.removeItem(key));
}

export default {
  set,
  get,
  remove,
  clear,
};
