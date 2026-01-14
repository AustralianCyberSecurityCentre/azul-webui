export interface StreamMetadataWithAuthor extends StreamMetadata {
  // Author
  author: string;
  version: string;
  category: string;
}

export interface StreamMetadata {
  file_format?: string;
  label: string;
  language: string;
  size: number;
  binary_sha256: string;
  datastream_sha256: string;
}
