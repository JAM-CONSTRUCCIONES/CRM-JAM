import { get, post, put, del } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';

const API_NAME = 'JamApi';

const authHeaders = async (): Promise<Record<string, string>> => {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
};

// Helper para manejar errores de forma consistente
const handleApiError = async (error: any): Promise<never> => {
  console.error('API Error:', error);
  
  try {
    const response = error?.response;
    
    if (response?.body) {
      // Intentar parsear el body del error
      let errorBody: any;
      
      try {
        // El body puede ser un ReadableStream, necesitamos parsearlo
        if (typeof response.body.json === 'function') {
          errorBody = await response.body.json();
        } else if (typeof response.body === 'string') {
          errorBody = JSON.parse(response.body);
        } else {
          errorBody = response.body;
        }
      } catch (jsonError) {
        console.error('Error parsing response body:', jsonError);
        errorBody = { message: 'Error al procesar la respuesta del servidor' };
      }
      
      // Extraer el mensaje de error
      const message = errorBody?.message || errorBody?.error || 'Error en la solicitud';
      
      // Crear error con estructura consistente
      const enhancedError: any = new Error(message);
      enhancedError.response = {
        status: response.statusCode,
        statusCode: response.statusCode,
        data: errorBody,
      };
      
      throw enhancedError;
    }
  } catch (parseError) {
    // Si ya es un error mejorado, lanzarlo
    if (parseError instanceof Error && (parseError as any).response) {
      throw parseError;
    }
  }
  
  // Fallback: crear error genérico
  const fallbackError: any = new Error(error?.message || 'Error en la solicitud');
  fallbackError.response = {
    status: error?.response?.statusCode || 500,
    statusCode: error?.response?.statusCode || 500,
    data: { message: error?.message || 'Error interno del servidor' },
  };
  throw fallbackError;
};

export const apiGet = async <T>(path: string): Promise<T> => {
  try {
    // Separar path y query params si existen
    const [basePath, queryString] = path.split('?');
    const queryParams: Record<string, string> = {};
    
    if (queryString) {
      const params = new URLSearchParams(queryString);
      params.forEach((value, key) => {
        queryParams[key] = value;
      });
    }
    
    const { body } = await get({
      apiName: API_NAME, 
      path: basePath,
      options: { 
        headers: await authHeaders(),
        queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      },
    }).response;
    return (await body.json()) as T;
  } catch (error) {
    return handleApiError(error);
  }
};

export const apiPost = async <T>(path: string, data: unknown): Promise<T> => {
  try {
    const [basePath, queryString] = path.split('?');
    const queryParams: Record<string, string> = {};
    if (queryString) {
      const params = new URLSearchParams(queryString);
      params.forEach((value, key) => { queryParams[key] = value; });
    }
    const { body } = await post({
      apiName: API_NAME,
      path: basePath,
      options: {
        headers: await authHeaders(),
        body: data as never,
        queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      },
    }).response;
    return (await body.json()) as T;
  } catch (error) {
    return handleApiError(error);
  }
};

export const apiPut = async <T>(path: string, data: unknown): Promise<T> => {
  try {
    const [basePath, queryString] = path.split('?');
    const queryParams: Record<string, string> = {};
    if (queryString) {
      const params = new URLSearchParams(queryString);
      params.forEach((value, key) => { queryParams[key] = value; });
    }
    const { body } = await put({
      apiName: API_NAME,
      path: basePath,
      options: {
        headers: await authHeaders(),
        body: data as never,
        queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      },
    }).response;
    return (await body.json()) as T;
  } catch (error) {
    return handleApiError(error);
  }
};

export const apiDelete = async <T>(path: string): Promise<T> => {
  try {
    const [basePath, queryString] = path.split('?');
    const queryParams: Record<string, string> = {};
    if (queryString) {
      const params = new URLSearchParams(queryString);
      params.forEach((value, key) => { queryParams[key] = value; });
    }
    const { body } = await del({
      apiName: API_NAME,
      path: basePath,
      options: {
        headers: await authHeaders(),
        queryParams: Object.keys(queryParams).length > 0 ? queryParams : undefined,
      },
    }).response;
    return (await body.json()) as T;
  } catch (error) {
    return handleApiError(error);
  }
};
