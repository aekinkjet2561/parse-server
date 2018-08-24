import rest from '../rest';

export function transformResult(className, result) {
  if (Array.isArray(result)) {
    return result.map((res) => transformResult(className, res));
  }
  if (result.objectId) {
    // Make a unique identifier for relay
    result.id = new Buffer(`${className}::${result.objectId}`).toString('base64');
  }
  return Object.assign({className}, result);
}

function toGraphQLResult(className) {
  return (restResult) => {
    const results = restResult.results;
    if (results.length == 0) {
      return [];
    }
    return transformResult(className, results);
  }
}

function transform(constraintKey, currentValue) {
  let value = currentValue;
  if (constraintKey === 'nearSphere') {
    value = {
      latitude: currentValue.point.latitude,
      longitude: currentValue.point.longitude,
    }
  }
  const key = `$${constraintKey}`;

  return {
    key,
    value,
  }
}

function transformQuery(query) {
  Object.keys(query).forEach((key) => {
    Object.keys(query[key]).forEach((constraintKey) => {
      const constraint = query[key][constraintKey];
      delete query[key][constraintKey];
      const result = transform(constraintKey, constraint);
      query[key][result.key] = result.value;
    });
  });
  return query;
}

// Runs a find against the rest API
export function runFind(context, info, className, args, schema, restQuery) {
  let query = {};
  if (args.where) {
    query = Object.assign(query, args.where);
  }
  if (args.objectId) {
    query = Object.assign(query, { objectId: args.objectId });
  }
  query = transformQuery(query, schema);
  if (restQuery)  {
    query = Object.assign({}, query, restQuery);
  }
  const options = {};
  if (Object.prototype.hasOwnProperty.call(args, 'first')) {
    options.limit = args.first;
    options.order = 'createdAt';
  }
  if (Object.prototype.hasOwnProperty.call(args, 'last')) {
    options.limit = args.last;
    options.order = '-createdAt';
  }
  if (Object.prototype.hasOwnProperty.call(args, 'after')) {
    query.createdAt = { '$gt': new Date(new Buffer(args.after, 'base64').toString('utf8')) }
  }
  if (Object.prototype.hasOwnProperty.call(args, 'before')) {
    query.createdAt = { '$lt': new Date(new Buffer(args.after, 'base64').toString('utf8')) }
  }
  if (Object.prototype.hasOwnProperty.call(args, 'redirectClassNameForKey')) {
    options.redirectClassNameForKey = args.redirectClassNameForKey;
  }
  return rest.find(context.config, context.auth, className, query, options)
    .then(toGraphQLResult(className));
}

// runs a get against the rest API
export function runGet(context, info, className, objectId) {
  return rest.get(context.config, context.auth, className, objectId, {})
    .then(toGraphQLResult(className))
    .then(results => results[0]);
}
