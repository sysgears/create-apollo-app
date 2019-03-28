import ApolloClient, { gql } from 'apollo-boost';
import * as React from 'react';
import { ApolloProvider, Query } from 'react-apollo';
import { Text, View } from 'react-native';
import * as url from 'url';

const GRAPHQL_PROD_URL = 'https://example.com:8080/graphql';

const LOCAL_HELLO = gql`
  query localHello($subject: String) {
    localHello(subject: $subject) @client
  }
`;

const SERVER_HELLO = gql`
  query serverHello($subject: String) {
    hello(subject: $subject)
  }
`;

const LocalHello = () => (
  <Query query={LOCAL_HELLO} variables={{ subject: 'World' }}>
    {({ loading, error, data }) => {
      if (loading) {
        return <Text>'Loading...'</Text>;
      }

      return <Text>Local Salutation: {error ? error.message : data.localHello}</Text>;
    }}
  </Query>
);

const ServerHello = () => (
  <Query query={SERVER_HELLO} variables={{ subject: 'World' }}>
    {({ loading, error, data }) => {
      if (loading) {
        return <Text>'Loading...'</Text>;
      }

      return (
        <Text>
          Server Salutation:&nbsp;
          {error
            ? error.message + '. You probably don`t have GraphQL Server running at the moment - thats okay'
            : data.hello}
        </Text>
      );
    }}
  </Query>
);

interface AppProps {
  exp: any;
}

const App = (props: AppProps) => {
  const apiUrl =
    process.env.NODE_ENV !== 'production'
      ? `http://${url.parse(props.exp.manifest.bundleUrl).hostname}:8080/graphql`
      : GRAPHQL_PROD_URL;

  const client = new ApolloClient({
    clientState: {
      resolvers: {
        Query: {
          localHello(obj: any, { subject }: { subject: string }) {
            return `Hello, ${subject}! from Mobile UI`;
          }
        }
      }
    },
    uri: apiUrl
  });

  return (
    <ApolloProvider client={client}>
      <View>
        <Text>Welcome to your own GraphQL mobile front end!</Text>
        <Text>You can start editing source code and see results immediately</Text>
        <LocalHello />
        <ServerHello />
      </View>
    </ApolloProvider>
  );
};

export default App;
