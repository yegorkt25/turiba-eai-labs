"""
Router Service
==============
Demonstrates two EIP patterns:
1. SPLITTER: Breaks a multi-item order into individual item messages
2. CONTENT-BASED ROUTER: Routes each item to the appropriate queue based on item.type

Consumes from: orders.incoming
Publishes to: orders.physical, orders.digital
"""

import json
import pika
import os


def get_rabbitmq_connection():
    """Create a connection to RabbitMQ using environment variable for host."""
    return pika.BlockingConnection(
        pika.ConnectionParameters(host=os.environ.get('RABBITMQ_HOST', 'localhost'))
    )


def route_order(ch, method, properties, body):
    """
    Process an incoming order:
    1. Parse the order message
    2. SPLITTER: Break order into individual item messages
    3. CONTENT-BASED ROUTER: Route each item based on its type
    """
    order = json.loads(body)
    order_id = order['orderId']
    correlation_id = order['correlationId']
    
    print(f"[Router] Processing order {order_id}")
    
    connection = get_rabbitmq_connection()
    channel = connection.channel()
    
    # Declare output queues (idempotent)
    channel.queue_declare(queue='orders.physical', durable=True)
    channel.queue_declare(queue='orders.digital', durable=True)
    channel.queue_declare(queue='orders.results', durable=True)
    
    items = order.get('items', [])
    item_count = len(items)
    
    # SPLITTER PATTERN: Break order into individual item messages
    for idx, item in enumerate(items):
        item_message = {
            'orderId': order_id,
            'correlationId': correlation_id,
            'itemIndex': idx,
            'totalItems': item_count,
            'item': item
        }
        
        # CONTENT-BASED ROUTER PATTERN: Route by item type
        item_type = item.get('type', 'physical')
        
        if item_type == 'physical':
            routing_key = 'orders.physical'
        elif item_type == 'digital':
            routing_key = 'orders.digital'
        else:
            # Default to physical for unknown types
            routing_key = 'orders.physical'
            print(f"[Router] Unknown item type '{item_type}', defaulting to physical")
        
        print(f"[Router] Routing item {idx} ({item_type}) to {routing_key}")
        
        channel.basic_publish(
            exchange='',
            routing_key=routing_key,
            body=json.dumps(item_message),
            properties=pika.BasicProperties(delivery_mode=2)  # Persistent
        )
    
    connection.close()
    
    # Acknowledge the original message after all items are routed
    ch.basic_ack(delivery_tag=method.delivery_tag)
    
    print(f"[Router] Order {order_id} split into {item_count} items and routed")


def main():
    """Main entry point: connect to RabbitMQ and start consuming orders."""
    connection = get_rabbitmq_connection()
    channel = connection.channel()
    
    # Declare input queue (idempotent)
    channel.queue_declare(queue='orders.incoming', durable=True)
    
    # Fair dispatch: don't give more than one message to a worker at a time
    channel.basic_qos(prefetch_count=1)
    
    # Start consuming
    channel.basic_consume(queue='orders.incoming', on_message_callback=route_order)
    
    print('[Router] Waiting for orders...')
    channel.start_consuming()


if __name__ == '__main__':
    main()
