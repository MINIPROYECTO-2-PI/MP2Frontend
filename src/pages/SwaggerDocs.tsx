import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import spec from "../docs/user-api.json";

export default function SwaggerDocs() {
  return (
    <div className="min-h-screen bg-white">
      <SwaggerUI
        spec={spec}
        docExpansion="list"
        defaultModelsExpandDepth={3}
        deepLinking={true}
        filter={true}
      />
    </div>
  );
}