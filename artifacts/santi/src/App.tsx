import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import SantiCommand from "@/pages/santi-command";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
    mutations: { retry: 0 },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SantiCommand />
    </QueryClientProvider>
  );
}

export default App;
