from diagrams import Diagram, Cluster, Edge
from diagrams.aws.compute import Lambda
from diagrams.aws.network import APIGateway, CloudFront
from diagrams.aws.storage import S3
from diagrams.custom import Custom
from diagrams.onprem.client import User

# Define the diagram
with Diagram("ChargeNear Architecture", show=False, direction="TB"):
    # User Browser
    user = User("User Browser\n(chargenear.org)")

    # AWS Components
    with Cluster("AWS"):
        cloudfront = CloudFront("CloudFront\n(Custom Domain)")
        s3 = S3("S3 Bucket\n(chargenear-hg)")
        api_gateway = APIGateway("API Gateway\n(/prod)")
        lambda_func = Lambda("Lambda\n(ChargeNearProxy)")

    # External APIs
    ocm = Custom("Open Charge Map API", "./ocm_logo.png", width="2", height="2")
    mapbox = Custom("Mapbox API", "./mapbox_logo.png", width="2", height="2", fontsize="20")

    # Connections
    user >> Edge(label="HTTPS Request") >> cloudfront
    cloudfront >> Edge(label="Serve Static Files") >> s3
    user >> Edge(label="API Request") >> api_gateway
    api_gateway >> Edge(label="Invoke") >> lambda_func
    lambda_func >> Edge(label="Fetch Charger Data") >> ocm
    user >> Edge(label="Geocoding & Map Rendering") >> mapbox

    # Map rendering back to user
    mapbox >> Edge(label="Render Map") >> user