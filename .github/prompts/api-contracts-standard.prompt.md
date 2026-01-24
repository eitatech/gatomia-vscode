````markdown
# API Contract Standards - Santander
## Extracted from copilot-instructions.md (gln-mktplc-kb-api-definitions)

## Required OpenAPI 3.0.1 Structure

### Info Section
```yaml
openapi: 3.0.1
info:
  title: {API Name}
  description: |-
    {API Description}

    The API can be used to:
    - {Operation 1}
    - {Operation 2}
  contact:
    name: API Global Governance
    email: apiglobalgovernance@gruposantander.com
  license:
    name: Apache
    url: https://www.apache.org/licenses/LICENSE-2.0
  version: 1.0.0
```

### Servers
```yaml
servers:
  - url: /v1/{api_name}
```

### Security
```yaml
security:
  - Authorization: []
```

### Security Schemes (OBRIGATÓRIO)
```yaml
components:
  securitySchemes:
    Authorization:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

---

## Required Response Codes

### For GET (list and detail)
- `200` - OK
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable
- `504` - Gateway Timeout

### For POST (creation)
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `415` - Unsupported Media Type
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable
- `504` - Gateway Timeout

### For PATCH/PUT (update)
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `415` - Unsupported Media Type
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable
- `504` - Gateway Timeout

### For DELETE
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable
- `504` - Gateway Timeout

---

## Standard Headers

### x-santander-client-id (REQUIRED)
```yaml
x-santander-client-id:
  name: x-santander-client-id
  in: header
  required: true
  schema:
    type: string
  description: "Client ID header"
  example: "a1b30a84-7bf3-442e-84a0-e935d8163b5a"
```

### accept-language (REQUIRED for some APIs)
```yaml
accept-language:
  name: accept-language
  in: header
  required: true
  schema:
    type: string
  description: |-
    Language and country header.

    The value is a 2-letter language code defined in ISO 639-1 alpha-2 followed by a 2-letter country code defined in ISO 3166-1 alpha-2, separated by a hyphen.
  example: "es-ES"
```

---

## Pagination (for GET list operations)

### Query Parameters
```yaml
_offset:
  name: _offset
  in: query
  schema:
    type: integer
    minimum: 0
  description: |-
    Pagination identifier that is returned to the app by the API response when this uses the HATEOAS '_prev' or '_next' links.

    The app can navigate from the last returned page to the next or previous page, or to the first page if no offset is specified, but to no other pages.
  example: 1

_limit:
  name: _limit
  in: query
  schema:
    type: integer
    minimum: 1
  description: |-
    Maximum number of rows to be included on each page in the response.

    Fewer rows can be returned if the query does not yield that many.

    The default value is 200.
  example: 10
```

### Response with Links (HATEOAS)
```yaml
_links:
  type: object
  description: "Data structure containing the links for moving between pages"
  properties:
    _first:
      type: object
      description: "Data structure containing link information"
      properties:
        href:
          type: string
          description: "Reference link to the first page"
          example: "http://www.host.com/v1/resource?_offset=0&_limit=10"
    _prev:
      type: object
      description: "Data structure containing link information"
      properties:
        href:
          type: string
          description: "Reference link to the previous page"
          example: "http://www.host.com/v1/resource?_offset=1&_limit=10"
    _next:
      type: object
      description: "Data structure containing link information"
      properties:
        href:
          type: string
          description: "Reference link to the next page"
          example: "http://www.host.com/v1/resource?_offset=2&_limit=10"
    _last:
      type: object
      description: "Data structure containing link information"
      properties:
        href:
          type: string
          description: "Reference link to the last page"
          example: "http://www.host.com/v1/resource?_offset=10&_limit=10"
```

---

## Errors Schema (REQUIRED)

```yaml
Errors:
  type: object
  description: "Data structure containing the details for errors"
  properties:
    errors:
      type: array
      description: "Array of errors"
      items:
        $ref: "#/components/schemas/Error"

Error:
  type: object
  description: "Data structure containing the error details"
  properties:
    code:
      type: string
      description: "Unique alphanumeric human readable error code"
      example: "INVALID_BARCODE"
    message:
      type: string
      description: "Brief summary of the reported issue"
      example: "Invalid barcode provided"
    level:
      type: string
      description: "Level of the reported issue"
      enum:
        - info
        - warning
        - error
      example: "error"
    description:
      type: string
      description: "Detailed description of the reported issue"
      example: "The barcode provided does not pass validation rules"
```

---

## Wrappers and Schemas Naming

### CORRECT - "Wrapper" Prefix
```yaml
WrapperCreateFileResponse:
  type: object
  description: "Data structure containing the response for creating a file"
  properties:
    file:
      $ref: "#/components/schemas/File"

WrapperGetFilesResponse:
  type: object
  description: "Data structure containing the response for retrieving files"
  properties:
    files:
      type: array
      items:
        $ref: "#/components/schemas/File"
    _links:
      $ref: "#/components/schemas/Links"

WrapperUpdateFileRequest:
  type: object
  description: "Data structure containing the request for updating a file"
  properties:
    file:
      $ref: "#/components/schemas/File"
```

### ❌ INCORRETO - Prefixo "_"
```yaml
# NÃO USAR
_GetFilesResponse:
  # ...

_CreateFileRequest:
  # ...
```

---

## Pre-Validations

### Rule 1: Query Parameters and Response Equivalents

**For GET list operations:**
- ALL query parameters MUST have equivalent values in the response

✅ **CORRETO:**
```yaml
GET /documents?name={name}

Response:
{
  "documents": [
    {
      "documentId": "1",
      "name": "Document One"  # ← query param "name" está no response
    }
  ]
}
```

❌ **INCORRETO:**
```yaml
GET /documents?name={name}

Response:
{
  "documents": [
    {
      "documentId": "1"
      # ← falta "name" no response
    }
  ]
}
```

### Rule 2: Main Entity Unique ID

**NOT allowed** to have query parameter that is unique ID of the main entity in GET list.

❌ **INCORRETO:**
```yaml
GET /documents?document_id={id}&name={name}
```

✅ **CORRECT - Create separate endpoint:**
```yaml
GET /documents/{document_id}

path Param:
  - document_id: Unique document ID
```

### Rule 3: Status and Types as ENUM

If the issue mentions "status" or "type", MUST request specification as ENUM:

**Mandatory questions:**
1. What does the "status" refer to? (E.g.: Payment Status, File Upload Status)
2. What are the possible codes and descriptions?

**Exemplo:**
```
Payment Status:
- PEND - Pending
- APPR - Approved
- CANC - Cancelled
- EXPI - Expired
```

---

## References to Terms Dictionary Entities

### URL Format
```yaml
Payment:
  $ref: 'https://raw.githubusercontent.com/santander-group-shared-assets/santander-terms-dictionary/development/TermsDictionary/SingleTerms/Payment.yaml#/Payment'

Amount:
  $ref: 'https://raw.githubusercontent.com/santander-group-shared-assets/santander-terms-dictionary/development/TermsDictionary/SingleTerms/Amount.yaml#/Amount'
```

### OR include inline YAML (if doesn't exist in dictionary)
```yaml
Parameter:
  type: object
  description: "Data structure containing information about a parameter"
  properties:
    code:
      type: string
      description: "Code for the parameter value"
      example: "001"
    description:
      type: string
      description: "Description of the parameter value"
      example: "FPS extended hold"
```

---

## PROHIBITED Fields

### ❌ NEVER Include
- `x-santander-catalogation` (legacy field removed)

### ✅ ALWAYS Include
- `securitySchemes` in components
- Complete response codes (minimum 9 codes)
- Standard headers (x-santander-client-id)
- Errors schema

---

## Contract Validation Checklist

Before finalizing contract, verify:

- [ ] openapi: 3.0.1
- [ ] info with title, description, contact, license, version
- [ ] servers with url
- [ ] security with Authorization
- [ ] securitySchemes defined in components
- [ ] All endpoints have required response codes
- [ ] Standard headers included (x-santander-client-id)
- [ ] Pagination (_offset, _limit, _links) for GET list
- [ ] Errors schema defined
- [ ] Wrappers with "Wrapper" prefix (not "_")
- [ ] WITHOUT x-santander-catalogation
- [ ] Entities reference dictionary via GitHub raw URL
- [ ] Tags defined and used
- [ ] operationId unique for each operation

````
