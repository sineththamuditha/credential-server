export interface OPARequest {
  input: { [key: string]: any };
}

export interface OPAResponse {
  result: {
    allow: boolean;
  };
}
